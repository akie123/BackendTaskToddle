require('dotenv').config();
const {GraphQLList ,GraphQLInt ,GraphQLString} = require('graphql');
const db = require("../database/db");
const {JournalType} = require('./types');
const jwt = require('jsonwebtoken');
const {eventEmitter} = require('../emitter');

class CustomError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

class AuthenticationError extends CustomError {
    constructor() {
        super('Authentication Error', 401);
    }
}

class NotATeacherError extends CustomError {
    constructor() {
        super('Not a teacher', 403);
    }
}

class JournalNotFoundError extends CustomError {
    constructor() {
        super('Journal entry not found', 404);
    }
}
const mutations = {
    login:{
        type: GraphQLString,
        args:{
            email:{type:GraphQLString},
            password:{type:GraphQLString}
        },
        resolve:  (parent, args) => {
             return  jwt.sign({email : args.email,password: args.password},process.env.TOKEN_SECRET,{expiresIn:'10h'})

        }
    },
    addJournal: {
        type: JournalType,
        args: {
            name: { type: GraphQLString },
            description: { type: GraphQLString },
            publishedAt: { type: GraphQLString },
            userTags: { type: new GraphQLList(GraphQLInt) },
        },
        resolve: async (parent, args, context) => {
            try {
                // Check if user is authenticated
                if (!context.user) {
                    throw new AuthenticationError();
                }

                // Fetch user data from the database
                const user = await getUserByEmail(context.user);

                // Check if user is a teacher
                if (user.role !== 'teacher') {
                    throw new NotATeacherError();
                }

                // Insert new journal entry

                 await db.promise().query(
                    'INSERT INTO journals (description, teacher_id, to_published, name) VALUES (?, ?, ?, ?)',
                    [args.description, user.id, args.publishedAt, args.name]
                );

                // Fetch the ID of the newly inserted journal
                const [newJournalId] = await db.promise().query(
                    'SELECT LAST_INSERT_ID() as id'
                );

                // Insert user tags if provided
                if (args.userTags && args.userTags.length > 0) {
                    for (const userTag of args.userTags) {
                        const toSendUser= await getUserById(userTag);
                        eventEmitter.emit('notification', toSendUser);
                        await db.promise().query(
                            'INSERT INTO journal_tag (journal_id, student_id) VALUES (?, ?)',
                            [newJournalId[0].id, userTag]
                        );
                    }
                }

                // Return the newly created journal entry
                return { id: newJournalId[0].id, ...args };
            } catch (error) {
                console.error("Error:", error);
                throw  new CustomError(error.message, error.statusCode || 500);;
            }
        }
    },
    updateJournal: {
        type: JournalType,
        args: {
            name: {type: GraphQLString},
            journal_id: {type: GraphQLInt},
            description: {type: GraphQLString},
            publishedAt: {type: GraphQLString},
            userTags: {type: new GraphQLList(GraphQLInt)},

        },
        resolve: async (parent, args,context) => {
            try {
                if (!context.user) {
                    throw new AuthenticationError();
                }
                // context.user = "teacher@example.com"
                // get user from db using email from context
                const user = await getUserByEmail(context.user)
                // Check if user is a teacher
                console.log(user.role)
                if (user.role ==!'teacher') {
                    throw new NotATeacherError();
                }
                else {
                    // Check if journal entry exists
                    const [existingJournal] = await db.promise().query(
                        'SELECT * FROM journals WHERE id = ?',
                        [args.journal_id]
                    );

                    // Check if journal entry exists
                    if (!existingJournal) {
                        throw new JournalNotFoundError();
                    }

                    // Update journal entry
                    await db.promise().query(
                        'UPDATE journals SET name = ?, description = ?, to_published = ? WHERE id = ?',
                        [args.name || existingJournal[0].name, args.description || existingJournal[0].description, args.publishedAt || existingJournal[0].to_published, args.journal_id]
                    );


                    // Add new user tags if provided
                    if (args.userTags && args.userTags.length > 0) {
                        await db.promise().query(
                            'DELETE FROM journal_tag WHERE journal_id = ?',
                            [args.journal_id]
                        );
                        for (const userTag of args.userTags) {
                            await db.promise().query(
                                'INSERT INTO journal_tag (journal_id, student_id) VALUES (?, ?)',
                                [args.journal_id, userTag]
                            );
                        }
                    }
                    return {id: args.journal_id, ...args};
                }

            } catch (error) {
                console.error("Error:", error);
                throw new CustomError(error.message, error.statusCode || 500);
            }



        }
    },
    deleteJournal: {
        type: JournalType,
        args: {
            id: {type: GraphQLInt},
        },
        resolve: async (parent, args,context) => {
            try {
                if (!context.user) {
                    throw new AuthenticationError();
                }

                const user = await getUserByEmail(context.user)
                console.log(user.role)
                if(user.role ==! 'teacher'){
                    throw new NotATeacherError();
                }
                else {
                    // Retrieve the existing journal entry by ID
                    const [existingJournal] = await db.promise().query(
                        'SELECT * FROM journals WHERE id = ?',
                        [args.id]
                    );

                    if (!existingJournal) {
                        throw new JournalNotFoundError();
                    }

                    // Delete attachments and user tags associated with the journal
                    await db.promise().query(
                        'DELETE FROM attachments WHERE journal_id = ?',
                        [args.id]
                    );
                    await db.promise().query(
                        'DELETE FROM journal_tag WHERE journal_id = ?',
                        [args.id]
                    );

                    // Delete the journal entry
                    await db.promise().query(
                        'DELETE FROM journals WHERE id = ?',
                        [args.id]
                    );

                    // Return the deleted journal entry or whatever your implementation requires
                    return {...existingJournal};
                }
            } catch (error) {
                console.error('Error:', error);
                throw new CustomError(error.message, error.statusCode || 500);

            }
        }
    }
}

async function getUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT * FROM users WHERE email = '${email}'`,
            (err, rows) => {
                if (err) {
                    reject(new CustomError('Database query error', 500));
                    return;
                }
                if (!rows[0]) {
                    reject(new CustomError('User not found', 404));
                    return;
                }
                resolve(rows[0]);
            }
        );
    });
}

async function getUserById(id) {
    return new Promise((resolve, reject) => {
        db.query(
            `SELECT * FROM users WHERE id = '${id}'`,
            (err, rows) => {
                if (err) {
                    reject(new CustomError('Database query error', 500));
                    return;
                }
                if (!rows[0]) {
                    reject(new CustomError('User not found', 404));
                    return;
                }
                resolve(rows[0]);
            }
        );
    });
}


module.exports = mutations;