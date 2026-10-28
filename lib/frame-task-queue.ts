type Task = {execute: () => void; cancel: () => void}

// Upload/raster work is finite, but several decoded images can finish together.
// Give each expensive job its own display frame, without another permanent loop.
export function createFrameTaskQueue() {
  const tasks: Task[] = []
  let frame = 0
  const flush = () => {
    frame = 0
    tasks.shift()?.execute()
    if(tasks.length && !frame)frame=window.requestAnimationFrame(flush)
  }
  return {
    run<T>(work: () => T): Promise<T | null> {
      return new Promise((resolve,reject) => {
        tasks.push({execute:()=>{try{resolve(work())}catch(error){reject(error)}},cancel:()=>resolve(null)})
        if(!frame)frame=window.requestAnimationFrame(flush)
      })
    },
    clear() {
      window.cancelAnimationFrame(frame);frame=0
      tasks.splice(0).forEach(task=>task.cancel())
    },
  }
}
