import nextTick from './nextTick'
import { runReaction as taskRunner } from './observer'

export const TARGET_FPS = 60
const PRIORITY = Symbol('task priority')
let taskProcessingQueued = false

export const priorities = {
  SYNC: 'sync',
  CRITICAL: 'critical',
  HIGH: 'high',
  LOW: 'low'
}

const DEFAULT_PRIORITY = priorities.CRITICAL

const validPriorities = new Set(['sync', 'critical', 'high', 'low'])

const queue = {
  [priorities.CRITICAL]: new Set(),
  [priorities.HIGH]: new Set(),
  [priorities.LOW]: new Set()
}

export function setTaskPriority (task, priority) {
  // remove task from previous queue and add to new priority queue
  // if it is set to sync -> run the task right away??!
  priority = priority || DEFAULT_PRIORITY
  if (!validPriorities.has(priority)) {
    throw new Error(`Invalid priority: ${priority}`)
  }
  task[PRIORITY] = priority
}

export function queueTask (task) {
  const priority = task[PRIORITY]
  if (priority === priorities.SYNC) {
    task()
  } else {
    queue[priority].add(task)
    if (!taskProcessingQueued) {
      nextTick(runQueuedTasks)
      taskProcessingQueued = true
    }
  }
}

export function unqueueTask (task) {
  const priority = task[PRIORITY]
  const queueWithPriority = queue[priority]
  if (queueWithPriority) {
    queueWithPriority.delete(task)
  }
}

export function runQueuedTasks () {
  const startDate = Date.now()
  const interval = 1000 / TARGET_FPS

  // critical tasks must all execute before the next frame
  const criticalTasks = queue[priorities.CRITICAL]
  criticalTasks.forEach(taskRunner)
  criticalTasks.clear()
  // high-prio tasks can run if there is free time remaining
  processQueue(priorities.HIGH, startDate, interval)
  // low-prio tasks can run if there is free time and no more high-prio tasks
  const isQueueEmpty = processQueue(priorities.LOW, startDate, interval)

  if (!isQueueEmpty) {
    nextTick(processQueuedTasks)
  } else {
    taskProcessingQueued = false
  }
}

function processQueue (priority, startDate, interval) {
  const queueWithPriority = queue[priority]
  const iterator = queueWithPriority[Symbol.iterator]()
  let task = iterator.next()
  while (startDate - Date.now() < interval) {
    if (task.done) {
      return true
    }
    taskRunner(task.value)
    queueWithPriority.delete(task)
    task = iterator.next()
  }
}