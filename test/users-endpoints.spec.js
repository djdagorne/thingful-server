const knex = require('knex')
const app = require('../src/app')
const helpers = require('./test-helpers')
const bcrypt = require('bcryptjs')

describe(`Users Endpoints`,function() {
    let db

    const { testUsers } = helpers.makeThingsFixtures()
    const testUser = testUsers[0]

    before(`make knex instance`,()=>{
        db = knex({
            client:'pg',
            connection: process.env.TEST_DB_URL
        })
        app.set('db', db)
    })

    after(`disconnect from db`,()=> db.destroy())

    before(`cleanup`,()=> helpers.cleanTables(db))

    afterEach(`cleanup`,()=> helpers.cleanTables(db))

    describe(`POST /api/users`,()=>{
        context(`User Validation`,()=>{
            beforeEach(`insert users`,()=>{
                helpers.seedUsers(
                    db,
                    testUsers
                )
            })

            //clear tables with afterEach statement?

            const requiredFields = ['user_name','password','full_name']
            requiredFields.forEach(field => {
                const registerAttemptBody = {
                    user_name: 'test user_name',
                    password: 'AAbb11!!',
                    full_name: 'test full_name'
                }

                it(`responds with 400 required error when '${field}' is missing`,()=>{
                    delete registerAttemptBody[field]
                    return supertest(app)
                        .post('/api/users')
                        .send(registerAttemptBody)
                        .expect(400, {
                            error: `Missing '${field}' in request body`
                        })
                })
            })

            it(`responds 400 'Password must be longer than 8 characters' when password has fewer than 8 characters`,()=>{
                const userShortPassword = {
                    user_name: 'test12 user_name',
                    password: '11AAaa!',
                    full_name: 'test full_name'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, {error: 'Password must be longer than 8 characters'})
            })

            it(`responds 400 'Password must be 72 characters or fewer' when password is more than 72 characters`,()=>{
                const userLongPassword = {
                    user_name: 'test123 user_name',
                    password: '*'.repeat(73),
                    full_name: 'test full_name'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userLongPassword)
                    .expect(400, {
                        error: 'Password must be 72 characters or fewer'
                    })
            })
            it(`responds 400 when password starts with a space`,()=>{
                const userPasswordStartsSpace = {
                    user_name: 'test1234 user_name',
                    password: ' 11AAaa!!',
                    full_name: 'test full_name'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordStartsSpace)
                    .expect(400, {
                        error: 'Password must not start or end with spaces'
                    })
            })
            it(`responds 400 when password ends with a space`,()=>{
                const userPasswordStartsSpace = {
                    user_name: 'test123 user_name',
                    password: '11AAaa!! ',
                    full_name: 'test full_name'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordStartsSpace)
                    .expect(400, {
                        error: 'Password must not start or end with spaces'
                    })
            })
            it(`responds 400 when password is not complex enough`,()=>{
                const userEasyPassword = {
                    user_name: 'test123 user_name',
                    password: 'aaaaaaaa',
                    full_name: 'test full_name'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userEasyPassword)
                    .expect(400, {
                        error: `Password must contain 1 upper case, lower case, number and special character`
                    })
            })
            it(`responds 400 'User name already taken' when user_name is not unique`,()=>{
                const duplicatedUserName = {
                    user_name: 'test-user-1', //this one causes an unhandled rejection error, and if moved anywhere else in the test causes its personal test to fail
                    password: 'AA11aa!!',
                    full_name: 'montgomery'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(duplicatedUserName)
                    .expect(400, {
                        error: 'Username already taken'
                    })
            })
            
            context(`Happy Path`,()=>{
                it(`responds 201, serialized user, storing bcrypted password`,()=>{
                    const newUser = {
                        user_name: 'tasdest user_name',
                        password: '11AAaa!!',
                        full_name: 'test full_name'
                    }
                    return supertest(app)
                        .post('/api/users')
                        .send(newUser)
                        .expect(201)
                        .expect(res => {
                            expect(res.body).to.have.property('id')
                            expect(res.body.user_name).to.eql(newUser.user_name)
                            expect(res.body.full_name).to.eql(newUser.full_name)
                            expect(res.body.nickname).to.eql('')
                            expect(res.body).to.not.have.property('password')
                            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
                            const expectedDate = new Date().toLocaleString('en',{timeZone:'UTC'})
                            const actualDate = new Date(res.body.date_created).toLocaleString()
                            expect(expectedDate).to.eql(actualDate)
                        })
                        .expect(res => {
                            db
                                .from('thingful_users')
                                .select('*')
                                .where({id: res.body.id})
                                .first()
                                .then(row=>{
                                    expect(row.user_name).to.eql(newUser.user_name)
                                    expect(row.full_name).to.eql(newUser.full_name)
                                    expect(row.nickname).to.eql(null)
                                    const expectedDate = new Date().toLocaleString('en', { timeZone: 'UTC' })
                                    const actualDate = new Date(row.date_created).toLocaleString()
                                    expect(actualDate).to.eql(expectedDate)

                                    return bcrypt.compare(newUser.password, row.password)
                                })
                                .then(compareMatch => {
                                    expect(compareMatch).to.be.true
                                })
                        })
                })
            })
        })
    })
})