import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
const app = express()

import bodyParser from 'body-parser'

import { ChatGPTAPI } from 'chatgpt'

import Twilio from 'twilio'
const { MessagingResponse } = Twilio.twiml

app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({
  extended: true
}))

const twilio = Twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)

const bot = new ChatGPTAPI({ sessionToken: process.env.CHATGPT_SESSION_TOKEN })
try {
  await bot.ensureAuth()
  console.info('ChatGPTAPI: Authentication successful')
} catch (err) {
  console.error('ChatGPTAPI: Authentication failed')
}

const threadingMap = new Map()

app.post('/receive', async (request, response) => {
  console.log("\n\n" + request.body.From)
  console.log("Received Request:\t\t" + request.body.Body)

  const to = request.body.To
  const from = request.body.From
  // if NOT from any of process.env.ALLOWED_NUMBERS, formatted as Number,Number,Number
  if (process.env.ALLOWED_NUMBERS.split(",").indexOf(from) === -1) {
    console.log("Received Request from Unauthorised Number")
    response.status(401).send("Unauthorized")
    return
  }

  if (from == 'whatsapp:+85293099921') {
    reply("Fuck Joel", response)
    return
  }

  reply("One moment...", response)

  const body = request.body.Body
  if (body === "RESET") {
    threadingMap.delete(from)
    send("Thread has been reset! Send another message to start fresh—so she doesn't remember your affairs.", from)
    return
  }

  const answer = await generateReply(body, from)
  send(answer, to, from)
})

async function generateReply(body, from) {
  try {
    // console.log("Generating Answer")
    var conversationId = ""
    var parentMessageId = ""
    if (threadingMap.has(from)) {
      const threading = threadingMap.get(from)
      conversationId = threading.conversationId
      parentMessageId = threading.parentMessageId
    }
    const answer = await bot.sendMessage(body, conversationId != "" ? { conversationId, parentMessageId } : {})
    var answerObj = JSON.parse(answer)
    // {"action":"next","messages":[{"id":"35d9e462-f36f-4edd-878d-bb7ed2aea441","role":"user","content":{"content_type":"text","parts":["Hello"]}}],"parent_message_id":"d05cbd3e-c684-43c8-bcb0-c2e0c642f942","model":"text-davinci-002-render"}
    // {"action":"next","messages":[{"id":"d637cb04-30d4-48e2-994c-3cfebba6f50b","role":"user","content":{"content_type":"text","parts":["Just try your best."]}}],"conversation_id":"272e14dc-a5a0-46d8-bc56-0a027855a7c7","parent_message_id":"36c87ff3-0f16-4c85-bfcf-7e94f46782ea","model":"text-davinci-002-render"}

    console.log("Generated Answer:\t\t" + answerObj.answer)

    if (!threadingMap.has(from)) {
      answerObj.answer += "\n\n_Welcome to ChatGPT x WhatsApp, ty @julianschiavo. This is a one-time extra message. You are in a thread. Send \"RESET\" to reset the thread so the bot forgets everything you've said._"
    }

    threadingMap.set(from, {
      conversationId: answerObj.conversationId,
      parentMessageId: answerObj.id
    })

    return answerObj.answer
  } catch (err) {
    console.log("Failed to Generate Answer")
    console.error(err)
    return "Sorry, I'm not feeling well."
  }
}

async function reply(answer, response) {
  const twiml = new MessagingResponse()
  twiml.message(answer)
  response
    .type('text/xml')
    .send(twiml.toString())
}

async function send(answer, from, to) {
  // console.log("Sending Message")

  // if answer length is greater than 1600, split into multiple messages
  if (answer.length > 600) {
    const messages = answer.match(/.{1,500}(?:\s|$)/gs)
    for (const message of messages) {
      await send(message, to)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    return
  }

  console.log("from: " + from, "to: " + to)
  var message = await twilio.messages
    .create({
      body: answer,
      from: from,
      to: to
    })
  // console.log("Sent Message: " + message.sid)
}

app.listen(1337)