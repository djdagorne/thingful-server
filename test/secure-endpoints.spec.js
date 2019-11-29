const knex = require('knex')
const app = require('../src/app')
const helpers = require('./test-helpers')

describe('Secure Endpoints', function() {
    let db
  
    const {
      testThings,
      testUsers,
      testReviews
    } = helpers.makeThingsFixtures()
  
    before('make knex instance', () => {
      db = knex({
        client: 'pg',
        connection: process.env.TEST_DB_URL,
      })
      app.set('db', db)
    })
  
    after('disconnect from db', () => db.destroy())
  
    before('cleanup', () => helpers.cleanTables(db))
  
    afterEach('cleanup', () => helpers.cleanTables(db))

    describe(`Protected Endpoints`,()=>{
        beforeEach(`insert things`,()=>
          helpers.seedThingsTables(
            db,
            testUsers,
            testThings,
            testReviews
          )
        )
        const protectedEndpoints = [
          {
            name: 'GET /api/things/:thing_id',
            path: '/api/things/1'
          },
          {
            name: 'GET /api/things/:thing_id/reviews',
            path: '/api/things/1/reviews'
          },
        ]
        protectedEndpoints.forEach(endpoint => {
          describe(endpoint.name,()=>{
            it(`responds 401 'Missing bearer token' when no token`,()=>{
              return supertest(app)
                .get(endpoint.path)
                .expect(401, {error: 'Missing bearer token'})
            })
            it(`responds 401 'Unauthorized request' when invalid JWT`,()=>{
              const validUser = testUsers[0]
              const invalidSecret = 'noway'
              return supertest(app)
                .get(endpoint.path)
                .set('Authorization', helpers.makeAuthHeader(validUser, invalidSecret))
                .expect(401, {error: `Unauthorized request`})
            })
            it(`responds 401 'Unauthorized request' when invalid sub in JWT payload`,()=>{
              const invalidUser = { user_name: 'no sir', id: 1}
              return supertest(app)
                .get(endpoint.path)
                .set('Authorization', helpers.makeAuthHeader(invalidUser))
                .expect(401, {error: `Unauthorized request`})
            })
          })
        })
    })
})