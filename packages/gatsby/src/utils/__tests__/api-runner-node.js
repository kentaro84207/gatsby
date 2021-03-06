const apiRunnerNode = require(`../api-runner-node`)

jest.mock(`../../redux`, () => {
  return {
    store: {
      getState: jest.fn(),
    },
    emitter: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }
})
jest.mock(`../get-cache`, () => {
  return {
    getCache: jest.fn(),
  }
})

const start = jest.fn()
const end = jest.fn()

const mockActivity = {
  start,
  end,
  done: end,
}

jest.mock(`gatsby-cli/lib/reporter`, () => {
  return {
    activityTimer: jest.fn(() => mockActivity),
    createProgress: jest.fn(() => mockActivity),
    panicOnBuild: jest.fn(),
  }
})

const { store, emitter } = require(`../../redux`)
const reporter = require(`gatsby-cli/lib/reporter`)
const { getCache } = require(`../get-cache`)

beforeEach(() => {
  store.getState.mockClear()
  emitter.on.mockClear()
  emitter.off.mockClear()
  emitter.emit.mockClear()
  start.mockClear()
  end.mockClear()
  reporter.panicOnBuild.mockClear()
  getCache.mockClear()
})

it(`Ends activities if plugin didn't end them`, async () => {
  jest.doMock(
    `test-plugin-correct/gatsby-node`,
    () => {
      return {
        testAPIHook: ({ reporter }) => {
          const spinnerActivity = reporter.activityTimer(
            `control spinner activity`
          )
          spinnerActivity.start()
          // calling activity.end() to make sure api runner doesn't call it more than needed
          spinnerActivity.end()

          const progressActivity = reporter.createProgress(
            `control progress activity`
          )
          progressActivity.start()
          // calling activity.done() to make sure api runner doesn't call it more than needed
          progressActivity.done()
        },
      }
    },
    { virtual: true }
  )
  jest.doMock(
    `test-plugin-spinner/gatsby-node`,
    () => {
      return {
        testAPIHook: ({ reporter }) => {
          const activity = reporter.activityTimer(`spinner activity`)
          activity.start()
          // not calling activity.end() - api runner should do end it
        },
      }
    },
    { virtual: true }
  )
  jest.doMock(
    `test-plugin-progress/gatsby-node`,
    () => {
      return {
        testAPIHook: ({ reporter }) => {
          const activity = reporter.createProgress(`progress activity`, 100, 0)
          activity.start()
          // not calling activity.end() or done() - api runner should do end it
        },
      }
    },
    { virtual: true }
  )
  jest.doMock(
    `test-plugin-spinner-throw/gatsby-node`,
    () => {
      return {
        testAPIHook: ({ reporter }) => {
          const activity = reporter.activityTimer(
            `spinner activity with throwing`
          )
          activity.start()
          throw new Error(`error`)
          // not calling activity.end() - api runner should do end it
        },
      }
    },
    { virtual: true }
  )
  jest.doMock(
    `test-plugin-progress-throw/gatsby-node`,
    () => {
      return {
        testAPIHook: ({ reporter }) => {
          const activity = reporter.createProgress(
            `progress activity with throwing`,
            100,
            0
          )
          activity.start()
          throw new Error(`error`)
          // not calling activity.end() or done() - api runner should do end it
        },
      }
    },
    { virtual: true }
  )
  store.getState.mockImplementation(() => {
    return {
      program: {},
      config: {},
      flattenedPlugins: [
        {
          name: `test-plugin-correct`,
          resolve: `test-plugin-correct`,
          nodeAPIs: [`testAPIHook`],
        },
        {
          name: `test-plugin-spinner`,
          resolve: `test-plugin-spinner`,
          nodeAPIs: [`testAPIHook`],
        },
        {
          name: `test-plugin-progress`,
          resolve: `test-plugin-progress`,
          nodeAPIs: [`testAPIHook`],
        },
        {
          name: `test-plugin-spinner-throw`,
          resolve: `test-plugin-spinner-throw`,
          nodeAPIs: [`testAPIHook`],
        },
        {
          name: `test-plugin-progress-throw`,
          resolve: `test-plugin-progress-throw`,
          nodeAPIs: [`testAPIHook`],
        },
      ],
    }
  })
  await apiRunnerNode(`testAPIHook`)

  expect(start).toBeCalledTimes(6)
  // we called end same amount of times we called start, even tho plugins
  // didn't call end/done themselves
  expect(end).toBeCalledTimes(6)
})

it(`Doesn't initialize cache in onPreInit API`, async () => {
  jest.doMock(
    `test-plugin-on-preinit-works/gatsby-node`,
    () => {
      return {
        onPreInit: () => {},
        otherTestApi: () => {},
      }
    },
    { virtual: true }
  )
  jest.doMock(
    `test-plugin-on-preinit-fails/gatsby-node`,
    () => {
      return {
        onPreInit: ({ cache }) => {
          cache.get(`foo`)
        },
      }
    },
    { virtual: true }
  )
  store.getState.mockImplementation(() => {
    return {
      program: {},
      config: {},
      flattenedPlugins: [
        {
          name: `test-plugin-on-preinit-works`,
          resolve: `test-plugin-on-preinit-works`,
          nodeAPIs: [`onPreInit`, `otherTestApi`],
        },
        {
          name: `test-plugin-on-preinit-fails`,
          resolve: `test-plugin-on-preinit-fails`,
          nodeAPIs: [`onPreInit`],
        },
      ],
    }
  })
  await apiRunnerNode(`onPreInit`)
  expect(getCache).not.toHaveBeenCalled()
  expect(reporter.panicOnBuild).toBeCalledTimes(1)
  expect(reporter.panicOnBuild.mock.calls[0][0]).toMatchObject({
    context: {
      api: `onPreInit`,
      pluginName: `test-plugin-on-preinit-fails`,
      sourceMessage: `Usage of "cache" instance in "onPreInit" API is not supported as this API runs before cache initialization (called in test-plugin-on-preinit-fails)`,
    },
  })

  // Make sure getCache is called on other APIs:
  await apiRunnerNode(`otherTestApi`)
  expect(getCache).toHaveBeenCalled()
})
