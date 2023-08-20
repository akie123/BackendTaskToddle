
const { GraphQLSchema, GraphQLObjectType, GraphQLList, GraphQLInt} = require('graphql');

const queries = require('./query');
const mutations = require('./mutation');
const {JournalType} = require("./types");
const DB = require("./db");
const db = require("../database/db");

const RootQuery = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: queries
});
const RootMutation = new GraphQLObjectType({
    name: 'RootMutationType',
    fields: mutations
});



module.exports = new GraphQLSchema({
    query: RootQuery,
    mutation: RootMutation
});

