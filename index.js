const {
  ApolloServer,
  gql,
  PubSub,
  AuthenticationError,
  UserInputError,
  withFilter,
  SchemaDirectiveVisitor,
} = require('apollo-server')
const { GraphQLScalarType, defaultFieldResolver } = require('graphql')
const { Kind } = require('graphql/language')
const GraphQLJSON = require('graphql-type-json')

class UpperCaseDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    const { resolve = defaultFieldResolver } = field
    field.resolve = async function(...args) {
      const result = await resolve.apply(this, args)
      if (typeof result === 'string') {
        return result.toUpperCase()
      }
      return result
    }
  }
}

const pubsub = new PubSub()
const SOMETHING_CHANGED_TOPIC = 'something_changed'

const typeDefs = gql`
  directive @upper on FIELD_DEFINITION

  scalar JSON
  scalar Date

  union Result = Book | Author

  type Book {
    title: String
  }

  type Author {
    name: String
  }

  type Class {
    name: String
  }

  type Color {
    name: String
  }

  interface Work {
    title: String
    author: Author
  }

  type TextWork implements Work {
    title: String
    author: Author
    classes: [Class]
  }

  type ColoringWork implements Work {
    title: String
    author: Author
    colors: [Color]
  }

  type Query {
    hello: String
    authenticationError: String
    jsonTest: JSON
    search: [Result]
    schoolWorks: [Work]
    directiveTest: String @upper
  }

  type Mutation {
    userInputError(input: String): String
  }

  type Subscription {
    newMessage: String
  }
`

const resolvers = {
  JSON: GraphQLJSON,

  Result: {
    __resolveType(obj, context, info) {
      if (obj.name) {
        return 'Author'
      }
      if (obj.title) {
        return 'Book'
      }
      return null
    },
  },

  Work: {
    __resolveType(work, context, info) {
      if (work.classes) {
        return 'TextWork'
      }
      if (work.colors) {
        return 'ColoringWork'
      }
      return null
    },
  },

  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value)
    },
    serialize(value) {
      return value.getTime()
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return parseInt(ast.value, 10)
      }
      return null
    },
  }),

  Query: {
    hello: () => 'hello',
    authenticationError: (parent, args, context) => {
      throw new AuthenticationError('must authenticate')
    },
    jsonTest: () => ({ test: 'json type' }),
    search: () => [{ name: 'test' }],
    schoolWorks: () => [
      { title: 'test', author: { name: 'a' }, colors: [{ name: 'red' }] },
    ],
    directiveTest: () => 'abc',
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
      subscribe: withFilter(
        () => pubsub.asyncIterator(SOMETHING_CHANGED_TOPIC),
        (payload, variables, context, info) => true
      ),
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
  subscriptions: {
    onConnect: (connectionParams, webSocket) => {
      // throw new Error('Missing auth token!')
    },
  },
  schemaDirectives: {
    upper: UpperCaseDirective,
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
