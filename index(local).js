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
const fetch = require("node-fetch");


require('dotenv').config();

// For Websockets.io
const server = require('http').createServer();

//For Mqtt
const mqtt = require("mqtt");

let sendData = 0;
let ACValue = 0;

//Connect to React Frontend
const cors = require('cors')
app.use(express.json());
app.use(cors());

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

// Defining websockets
const io= require('socket.io')(server,{
  transports: ['websocket', 'polling']
});

//Variables
var tempS = '';
var humidityS = '';
var pressureS = '';
var lumS = '';
// var timeFormated = '';

//Connecting to mqtt
var options={
      port: "1883",
      protocol: "mqtt",
      clientId: "mqttjs01",
      hostname: "broker.hivemq.com",
    };
var client = mqtt.connect(options);
client.subscribe("AIEMSL1/temperature");
client.subscribe("AIEMSL1/humidity");
client.subscribe("AIEMSL1/pressure");
client.subscribe("AIEMSL1/luminance"); 
// console.log("connected  "+client.connected);

client.on('message', function(topic, msg){
  console.log(topic+" Message Recieved -> "+msg.toString());
  // if(acValueRecieve){
  //   client.publish('AIEMSL1/ACD', acTemp.toString(),opts=options);
  //   acValueRecieve=false
  //   console.log('AC value sent');
  // }
  if(topic.toString()==="AIEMSL1/temperature"){
    tempS = msg.toString();
    sendData++;
      }
  if(topic.toString()==="AIEMSL1/humidity"){
    humidityS = msg.toString();
    sendData++;
  }
  if(topic.toString()==="AIEMSL1/pressure"){
    pressureS = msg.toString();
    sendData++;
  }
  if(topic.toString()==="AIEMSL1/luminance"){
    lumS = msg.toString();
    sendData++;
  }
  //Send Data to ac
  if(ACValue!=0){
    if(client.connected){
      client.publish('AIEMSL1/ACD', ACValue.toString(),opts=options);
      console.log('Ac Value sent');
      
    }else{
      console.log('Ac Value not sent');
    }
    ACValue=0
  }
  
  // emit to sockets.io
  io.emit('cpu',{name: 'cpu', temp: tempS, humidity: humidityS, pressure: pressureS, lum: lumS });
  console.log(sendData);
  if(sendData===4){
    let date_ob = new Date().toISOString();
    const event = new EntryModel({
      readingtime: new Date().toISOString(),
      temperature: tempS,
      humidity: humidityS,
      pressure: pressureS,
      altitude: lumS,
      temperature_status: "Coming Soon",
      humidity_status: "Coming Soon",
      pressure_status: "Coming Soon",
    });
    return event.save().then((r)=>{
      console.log('saved to database');
      sendData=0;
    }    
    ).catch(err=>{
      console.log('Error saving to database');
            });  
    // axios.post("http://localhost:3001/createEntry", {
    //           readingtime: date_ob,
    //           temperature: tempS,
    //           humidity: humidityS,
    //           pressure: pressureS,
    //           altitude: lumS,
    //           temperature_status: "Coming Soon",
    //           humidity_status: "Coming Soon",
    //           pressure_status: "Coming Soon",
    //         }).then((response) => {
    //           console.log('Data Sent')
    //           sendData=0;
    //       }).catch(err=>{
    //         throw err;
    //       });   
  }
})
// setInterval(()=>{
  
//   }, 5000);
io.on("connection", (socket) => {
  console.log('MQTT connection established')
  io.emit('cpu',{name: 'cpu', temp: tempS, humidity: humidityS, pressure: pressureS, lum: lumS });
});
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
            events(cutoff: String!): [Event!]!
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
      events: async({cutoff}) => {
        try {
          const events = await EntryModel.find({ readingtime: { $gte: cutoff } });
          return events.map(event => {
            return { ...event._doc, _id: event.id };
          });
        } catch (err) {
          throw err;
        }
      },
      recieveACvalue: async({input})=>{
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
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.p3ddg.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`
  )
  .then(() => {
    console.log('Database Server Running')
    app2.listen(process.env.PORT1 || 8000, () => {
      console.log("graphql Server running")
    });

    server.listen(process.env.PORT2 || 4001, () => {
      console.log("Sockets Server Running");
    });
    
    // app.listen(3001, () => {
    //   console.log("HTTP server runs perfectly")
    // });
  })
  .catch(err => {
    console.log(err);
  });