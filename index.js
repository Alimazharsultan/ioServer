//MongoDB
// Logic added for sending data just at the time when all four values are recieved from mqtt

const express = require("express")
const app = express();
const mongoose = require('mongoose')
const EntryModel = require('./models/location3data')
const User = require('./models/users')
const axios = require('axios')
const bodyParser = require('body-parser');
const {graphqlHTTP} = require('express-graphql');
const { buildSchema } = require('graphql');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const isAuth = require('./middleware/is-auth');


require('dotenv').config();



//For mongoose
const app2 = express();
app2.use(bodyParser.json());

app2.use(isAuth);

app2.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});


// app.get("/getData", (req, res) => {
//     EntryModel.find({}, (err, result)=>{
//         if (err){
//             res.json(err);
//         } else {
//             res.json(result);
//         }
//     });
// });
// app.post("/createEntry", async (req, res) => {
//     const entry = req.body
//     const newEntry = new EntryModel(entry);
//     await newEntry.save();
//     res.json(entry);
// });

;
//GraphQl API
app2.use(
  '/graphql',
  graphqlHTTP({
    schema: buildSchema(`
        type Event {
          _id: ID!
          readingtime: String
          temperature: String
          humidity: String
          pressure: String
          altitude: String
          temperature_status: String
          humidity_status: String
          pressure_status: String
        }
        type User {
          _id: ID!
          username: String!
          password: String
        }
        type AuthData {
          userId: ID!
          token: String!
          tokenExpiration: Int!
          username: String
        }
        type AC_temp{
          temp: Int!
        }
        input EventInput {
          readingtime: String
          temperature: String
          humidity: String
          pressure: String
          altitude: String
          temperature_status: String
          humidity_status: String
          pressure_status: String
        }
        input UserInput {
          username: String!
          password: String!
        }
        type RootQuery {
            events(cutoff1: String!,cutoff2: String): [Event!]!
            login(username: String!, password: String!): AuthData!
        }
        type RootMutation {
            createEvent(eventInput: EventInput): Event
            createUser(userInput: UserInput): User
            recieveACvalue(input: Int!): Int
        }
        schema {
            query: RootQuery
            mutation: RootMutation
        }
    `),
    rootValue: {
      events: async({cutoff1,cutoff2}) => {
        try {
          const events = await EntryModel.find({ readingtime: { $gte: cutoff1, $lte:cutoff2} });
          return events.map(event => {
            return { ...event._doc, _id: event.id };
          });
        } catch (err) {
          throw err;
        }
      },
      recieveACvalue: async({input})=>{
        console.log('Ac value recieved');
        // io.emit("AC",{value:+input});
        if(client.connected){
          client.publish('AIEMSL1/ACD', input.toString(),opts=options);
          console.log('Ac Value sent');
          ACValue = 0;
          
        }else{
          ACValue = input;
        }
        
        return input
      },
      createEvent: async(args,req) => {
        // if(!req.isAuth){
        //   throw new Error("Unauthenticated!");
        // }
        const event = new EntryModel({
          readingtime: new Date().toISOString(),
          temperature: args.eventInput.temperature,
          humidity: args.eventInput.humidity,
          pressure: args.eventInput.pressure,
          altitude: args.eventInput.altitude,
          temperature_status: args.eventInput.temperature_status,
          humidity_status: args.eventInput.humidity_status,
          pressure_status: args.eventInput.pressure_status,
        });
        let createdEvent;
        return event.save()
          
      },
      createUser: args => {
        return User.findOne({ username: args.userInput.username })
          .then(user => {
            if (user) {
              throw new Error('User exists already.');
            }
            return bcrypt.hash(args.userInput.password, 12);
          })
          .then(hashedPassword => {
            const user = new User({
              username: args.userInput.username,
              password: hashedPassword
            });
            return user.save();
          })
          .then(result => {
            return { ...result._doc, password: null, _id: result.id };
          })
          .catch(err => {
            throw err;
          });
      },
      login: async ({ username, password }) => {
        const user = await User.findOne({ username: username });
        if (!user) {
          throw new Error('User does not exist!');
        }
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) {
          throw new Error('Password is incorrect!');
        }
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          'KhufiaMahfoozChaabi',
          {
            expiresIn: '1h'
          }
        );
        return { userId: user.id, username:user.username, token: token, tokenExpiration: 1 };
      }
    },
    graphiql: true
  })
);

// mongodb+srv://ali:<password>@cluster0.p3ddg.mongodb.net/test

mongoose
  .connect(
    // `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.p3ddg.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`
    `mongodb+srv://ali:great@cluster0.p3ddg.mongodb.net/merntutorial?retryWrites=true&w=majority`
  )
  .then(() => {
    console.log('Database Server Running')
    app2.listen(process.env.PORT || 8000, () => {
      console.log("graphql Server running")
    });

    
    
    // app.listen(3001, () => {
    //   console.log("HTTP server runs perfectly")
    // });
  })
  .catch(err => {
    console.log(err);
  });