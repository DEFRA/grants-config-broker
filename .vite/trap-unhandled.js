process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION')
  console.error(reason)
  console.error(reason?.stack)
})
