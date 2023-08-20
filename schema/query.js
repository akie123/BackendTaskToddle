const { GraphQLList } = require('graphql');
const { JournalType } = require('./types');
const db = require("../database/db");
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

class TeacherPermissionError extends CustomError {
    constructor() {
        super('User is not a teacher', 403);
    }
}

class StudentPermissionError extends CustomError {
    constructor() {
        super('User is not a student', 403);
    }
}
const queries = {
    teacherFed: {
        type: new GraphQLList(JournalType),
        args: {},
        resolve: async (parent, args, context) => {
            try {
                if (!context.user) {
                    throw new AuthenticationError();
                }

                const user = await getUserByEmail(context.user);
                if (user.role !== 'teacher') {
                    throw new TeacherPermissionError();
                }

                const journals = await getJournalsByTeacherId(user.id);
                return journals;
            } catch (error) {
                console.error(error);
                throw new CustomError(error.message, error.statusCode || 500);

            }
        }
    },
    studentFed: {
        type: new GraphQLList(JournalType),
        args: {},
        resolve: async (parent, args, context) => {
            try {
                if (!context.user) {
                    throw new AuthenticationError();
                }

                const user = await getUserByEmail(context.user);
                if (user.role !== 'student') {
                    throw new StudentPermissionError();
                }

                const journals = await getJournalsByStudentId(user.id);
                return journals;
            } catch (error) {
                console.error(error);
                throw new CustomError(error.message, error.statusCode || 500);
            }
        },
    },

}

async function getUserByEmail(email){
    return await new Promise((resolve, reject) => {
        db.query(
            `SELECT * FROM users WHERE email = '${email}'`,
            (err, rows, fields) => {
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
    })
}

async function getJournalsByTeacherId(teacherId){
    return await new Promise((resolve, reject) => {
        db.query(
            `SELECT j.*, a.id AS attachment_id, a.type AS attachment_type, a.url AS attachment_url
           FROM journals j
           LEFT JOIN attachments a ON j.id = a.journal_id
           WHERE j.teacher_id = ${teacherId}`,
            (err, rows, fields) => {
                if (err) {

                    reject(new CustomError('Database query error', 500));
                    return;
                }

                const journals = {};
                rows.forEach(row => {
                    const {
                        id,
                        description,
                        teacher_id,
                        to_published,
                        attachment_id,
                        attachment_type,
                        attachment_url,
                        name
                    } = row;

                    if (!journals[id]) {
                        journals[id] = {
                            id,
                            description,
                            teacher_id,
                            to_published,
                            name,
                            attachments: [],
                        };
                    }

                    if (attachment_id) {
                        journals[id].attachments.push({
                            id: attachment_id,
                            type: attachment_type,
                            url: attachment_url,
                        });
                    }
                });

                resolve(Object.values(journals));
            }
        );
    });
}

async function getJournalsByStudentId(studentId){
    const currentTime = new Date().toISOString(); // Current time in ISO format

    return new Promise((resolve, reject) => {
        db.query(
            `SELECT j.*, a.id AS attachment_id, a.type AS attachment_type, a.url AS attachment_url
           FROM journals j
           LEFT JOIN attachments a ON j.id = a.journal_id
           JOIN journal_tag jt ON j.id = jt.journal_id
           WHERE jt.student_id = ${studentId}
             AND j.to_published <= '${currentTime}'`,
            (err, rows, fields) => {
                if (err) {
                    console.log(err);
                    reject(new CustomError('Database query error', 500));
                    return;
                }

                const journals = {};
                rows.forEach(row => {
                    const {
                        id,
                        description,
                        teacher_id,
                        to_published,
                        attachment_id,
                        attachment_type,
                        attachment_url
                    } = row;

                    if (!journals[id]) {
                        journals[id] = {
                            id,
                            description,
                            teacher_id,
                            to_published,
                            attachments: [],
                        };
                    }

                    if (attachment_id) {
                        journals[id].attachments.push({
                            id: attachment_id,
                            type: attachment_type,
                            url: attachment_url,
                        });
                    }
                });

                resolve(Object.values(journals));
            }
        );
    });
}

module.exports = queries;