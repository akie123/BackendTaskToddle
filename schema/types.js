
const {GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLSchema, GraphQLList, GraphQLNonNull, GraphQLEnumType,
    GraphQLInputObjectType
} = require('graphql');

// User Type
const UserType = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
        id: {type: GraphQLInt},
        name: {type: GraphQLString},
        password: {type: GraphQLString},
        email: {type: GraphQLString},
        role: {type: new GraphQLEnumType({
            name: 'Role',
            values: {'teacher': {value: 'teacher'}, 'student': {value: 'student'}}
        })},
    })
})

//Attachment Type
const AttachmentType = new GraphQLObjectType({
    name: 'Attachment',
    fields: {
        url: {type: GraphQLString},
        type: {
            type: new GraphQLEnumType({
                name: 'AttachmentType1',
                values: {
                    IMAGE: { value: 'image' },
                    VIDEO: { value: 'video' },
                    URL: { value: 'url' },
                    PDF: { value: 'pdf' },
                },
            })}
    },
});

//Attachment Type
const AttachmentInputType = new GraphQLInputObjectType({
    name: 'AttachmentInput',
    fields: {
        url: {type: GraphQLString},

        type: {
            type: new GraphQLEnumType({
                name: 'AttachmentType',
                values: {
                    IMAGE: { value: 'image' },
                    VIDEO: { value: 'video' },
                    URL: { value: 'url' },
                    PDF: { value: 'pdf' },
                },
            })}
    },
});


//Journal Type
const JournalType = new GraphQLObjectType({
    name: 'Journal',
    fields: {
        id: {type: GraphQLInt},
        name:{type: GraphQLString},
        description: {type: GraphQLString},
        publishedAt: {type: GraphQLString},
        attachments: {type: new GraphQLList(AttachmentType)},

    }
})


module.exports = {UserType, JournalType,AttachmentInputType,AttachmentType}