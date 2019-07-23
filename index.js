const {
  ApolloServer,
  gql,
  PubSub,
  AuthenticationError,
  UserInputError,
} = require('apollo-server')

const pubsub = new PubSub()
const SOMETHING_CHANGED_TOPIC = 'something_changed'

const typeDefs = gql`
  type Query {
    hello: String
    authenticationError: String
  }

  type Mutation {
    userInputError(input: String): String
  }

  type Subscription {
    newMessage: String
  }
`

const resolvers = {
  Query: {
    hello: () => 'hello',
    authenticationError: (parent, args, context) => {
      throw new AuthenticationError('must authenticate')
    },
  },

  Mutation: {
    userInputError: (parent, args, context, info) => {
      if (args.input !== 'expected') {
        throw new UserInputError('Form Arguments invalid', {
          invalidArgs: Object.keys(args),
        })
      }
    },
  },

  Subscription: {
    newMessage: {
      subscribe: () => pubsub.asyncIterator(SOMETHING_CHANGED_TOPIC),
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // onHealthCheck: () =>
  //   new Promise((resolve, reject) => {
  //     //database check or other asynchronous action
  //     reject(500)
  //   }),
  formatError: err => {
    console.log(err)
    // Don't give the specific errors to the client.
    if (err.message.startsWith('Database Error: ')) {
      return new Error('Internal server error')
    }

    // Otherwise return the original error.  The error can also
    // be manipulated in other ways, so long as it's returned.
    return err
  },
})

server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})

//publish events every second
setInterval(
  () =>
    pubsub.publish(SOMETHING_CHANGED_TOPIC, {
      newMessage: new Date().toString(),
    }),
  1000
)
