import React from 'react'
import { TouchableOpacity, Text, View, TextInput, ScrollView, Platform } from 'react-native'
import io, { Socket } from 'socket.io-client'
import { RelativeTime } from 'relative-time-react-native-component'
import { DocumentPicker, DocumentPickerUtil } from 'react-native-document-picker'
import * as RNFS from 'react-native-fs'
import * as base64 from 'base-64'
import QRCode from 'react-native-qrcode'
import PushNotification from 'react-native-push-notification'
import { RTCDataChannel, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc'
import SplitFile from 'js-split-file'
import { Picker } from '@react-native-community/picker'
import AsyncStorage from '@react-native-community/async-storage'
import Clipboard from '@react-native-community/clipboard'
import PushNotificationIOS from '@react-native-community/push-notification-ios'

const supportWebRTC = true

const blocks: Uint8Array[] = []

function getRoom() {
  return Math.round(Math.random() * 35 * Math.pow(36, 9)).toString(36)
}

PushNotification.configure({
  onNotification: notification => {
    if (Platform.OS === 'ios') {
      notification.finish(PushNotificationIOS.FetchResult.NoData)
    }
  }
})

function notify(title: string) {
  PushNotification.localNotification({ message: title })
}

function uint8ArrayToBase64(array: Uint8Array) {
  let result = ''
  for (const item of array) {
    result += String.fromCharCode(item)
  }
  return base64.encode(result)
}

const baseUrl = 'https://copy.yorkyao.com/'
const gotFileMessage = 'You got a file!'

const speeds = [
  { value: 10, text: '100KB/s' },
  { value: 20, text: '200KB/s' },
  { value: 50, text: '500KB/s' },
  { value: 100, text: '1MB/s' },
  { value: 200, text: '2MB/s' },
  { value: 500, text: '5MB/s' },
  { value: 1000, text: '10MB/s' },
  { value: Infinity, text: 'No limit(Will block the UI)' }
]

export default class App extends React.Component {
  state = {
    acceptMessages: [] as (TextData | Base64Data)[],
    newText: '',
    clientCount: 0,
    room: '',
    files: [] as Block[],
    speed: 100,
    dataChannelIsOpen: false
  }
  private dataChannel: RTCDataChannel | null = null
  private socket?: Socket
  private id = 1
  private peerConnection = supportWebRTC ? new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }) : null
  private splitFile = new SplitFile()
  private timer?: NodeJS.Timer
  componentDidMount() {
    AsyncStorage.getItem('room').then(roomInStorage => {
      if (!roomInStorage) {
        this.setState({ room: getRoom() }, () => {
          AsyncStorage.setItem('room', this.state.room).then(() => {
            this.connect()
          })
        })
      } else {
        this.setState({ room: roomInStorage }, () => {
          this.connect()
        })
      }
    })

    if (this.peerConnection) {
      this.dataChannel = this.peerConnection.createDataChannel('copy_tool_channel_name')
      this.peerConnection.ondatachannel = event => {
        event.channel.onopen = e => {
          this.state.acceptMessages.unshift({
            kind: DataKind.text,
            value: `The connection is opened.`,
            moment: Date.now(),
            id: this.id++
          })
          this.setState({
            dataChannelIsOpen: true,
            acceptMessages: this.state.acceptMessages
          })

        }
        event.channel.onclose = e => {
          this.state.acceptMessages.unshift({
            kind: DataKind.text,
            value: `The connection is closed.`,
            moment: Date.now(),
            id: this.id++
          })
          this.setState({
            dataChannelIsOpen: false,
            acceptMessages: this.state.acceptMessages
          })
        }
        event.channel.onmessage = e => {
          if (typeof e.data === 'string') {
            this.state.acceptMessages.unshift({
              kind: DataKind.text,
              value: e.data,
              moment: Date.now(),
              id: this.id++
            })
            this.setState({
              acceptMessages: this.state.acceptMessages
            })
            notify('You got a text message!')
          } else {
            const block = this.splitFile.decodeBlock(new Uint8Array(e.data as ArrayBuffer))
            let currentBlockIndex = this.state.files.findIndex(f => f.fileName === block.fileName)
            if (currentBlockIndex === -1) {
              currentBlockIndex = this.state.files.length
              this.state.files.push({
                fileName: block.fileName,
                blocks: [],
                progress: 0
              })
            }
            const currentBlock = this.state.files[currentBlockIndex]!
            currentBlock.blocks.push({
              currentBlockIndex: block.currentBlockIndex,
              binary: block.binary
            })
            currentBlock.progress = Math.round(currentBlock.blocks.length * 100.0 / block.totalBlockCount)
            if (currentBlock.blocks.length === block.totalBlockCount) {
              currentBlock.blocks.sort((a, b) => a.currentBlockIndex - b.currentBlockIndex)
              const mergedUint8Array = new Uint8Array([...currentBlock.blocks.reduce((p, c) => new Uint8Array([...p, ...c.binary]), new Uint8Array([]))])
              this.state.acceptMessages.unshift({
                kind: DataKind.base64,
                value: uint8ArrayToBase64(mergedUint8Array),
                name: block.fileName,
                moment: Date.now(),
                id: this.id++
              })
              this.state.files.splice(currentBlockIndex, 1)
              this.setState({
                files: this.state.files,
                acceptMessages: this.state.acceptMessages
              })
              notify(gotFileMessage)
            } else {
              this.setState({
                files: this.state.files
              })
            }
          }
        }
      }
    }

    this.timer = setInterval(() => {
      if (blocks.length > 0) {
        blocks.splice(0, this.state.speed).forEach(block => {
          this.dataChannel!.send(block)
        })
      }
    }, 1000)
  }
  componentWillUnmount() {
    if (this.socket) {
      this.socket.close()
    }
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
  render() {
    const messages = this.state.acceptMessages.map(message => {
      let content: JSX.Element | undefined
      let button: JSX.Element | undefined
      if (message.kind === 'text') {
        content = <Text style={{
          padding: 9.5,
          backgroundColor: '#f5f5f5',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ccc',
          borderRadius: 4,
          marginBottom: 10
        }}>{message.value}</Text>
        button = <TouchableOpacity style={{
          paddingLeft: 7,
          paddingRight: 7,
          borderRadius: 3,
          borderColor: '#ccc',
          borderStyle: 'solid',
          borderWidth: 1,
          justifyContent: 'center'
        }} onPress={() => this.copyTextToClipboard(message.value)}>
          <Text style={{ textAlign: 'center' }}>copy</Text>
        </TouchableOpacity>
      } else if (message.kind === 'base64') {
        button = <TouchableOpacity style={{
          paddingLeft: 7,
          paddingRight: 7,
          justifyContent: 'center'
        }} onPress={() => this.downloadFile(message)}>
          <Text style={{ textAlign: 'center', color: '#337ab7' }}>{message.name}</Text>
        </TouchableOpacity>
      }
      return (
        <View key={message.id}>
          <View style={{ height: 21, flexDirection: 'row' }}>
            <Text style={{
              minWidth: 67,
              backgroundColor: '#777',
              color: '#fff',
              borderRadius: 3,
              justifyContent: 'center',
              textAlign: 'center',
              paddingLeft: 7,
              paddingRight: 7
            }}>
              <RelativeTime time={message.moment}></RelativeTime>
            </Text>
            <Text style={{
              backgroundColor: '#5bc0de',
              color: '#fff',
              borderRadius: 3,
              justifyContent: 'center',
              textAlign: 'center',
              paddingLeft: 7,
              paddingRight: 7
            }}>{message.kind}</Text>
            {button}
          </View>
          {content}
        </View>
      )
    })
    const buttonText = this.state.clientCount > 0 ? `Copy the text to ${this.state.clientCount} clients` : 'No clients to sent'
    const pickFile = Platform.OS === 'android' ? <TouchableOpacity style={{
      height: 40,
      backgroundColor: '#286090',
      justifyContent: 'center',
      marginBottom: 5
    }} onPress={() => this.pickFile()} >
      <Text style={{
        color: '#fff',
        textAlign: 'center'
      }}>Pick file</Text>
    </TouchableOpacity> : null
    const url = baseUrl + '#' + this.state.room
    const tryToConnect = supportWebRTC && !this.state.dataChannelIsOpen ? <TouchableOpacity style={{
      height: 40,
      backgroundColor: '#fff',
      borderColor: '#ccc',
      borderWidth: 1,
      justifyContent: 'center',
      marginBottom: 5
    }} onPress={() => this.tryToConnect()} >
      <Text style={{
        color: '#333',
        textAlign: 'center'
      }}>try to connect</Text>
    </TouchableOpacity> : null
    const progress = this.state.files.map((file, i) => <Text key={i}>{file.fileName}: {file.progress} %</Text>)
    const pickerItems = speeds.map((speed, i) => <Picker.Item key={i} label={speed.text} value={speed.value} />)
    const speedPicker = <Picker
      selectedValue={this.state.speed}
      onValueChange={speed => this.setState({ speed })}>
      {pickerItems}
    </Picker>
    return (
      <ScrollView style={{ flex: 1, padding: 15 }}>
        <Text style={{ height: 40 }}>Copy-Tool</Text>
        <TextInput style={{ height: 40, width: '100%', marginBottom: 5 }}
          placeholder='room'
          autoCapitalize='none'
          onChangeText={room => this.changeRoom(room)}
          onBlur={() => this.connectToNewRoom()}
          value={this.state.room}>
        </TextInput>
        <TextInput style={{ height: 110, marginBottom: 5 }}
          placeholder='text message'
          multiline
          autoCapitalize='none'
          numberOfLines={5}
          onChangeText={text => this.changeNewText(text)}
          value={this.state.newText}>
        </TextInput>
        <TouchableOpacity style={{
          height: 40,
          backgroundColor: '#286090',
          justifyContent: 'center',
          marginBottom: 5
        }} onPress={() => this.copyText()} >
          <Text style={{
            color: '#fff',
            textAlign: 'center'
          }}>{buttonText}</Text>
        </TouchableOpacity>
        {tryToConnect}
        {progress}
        {speedPicker}
        {pickFile}
        {messages}
        <QRCode value={url} size={150} />
      </ScrollView>
    )
  }
  private changeNewText(text: string) {
    this.setState({ newText: text })
  }
  private changeRoom(room: string) {
    this.setState({ room })
  }
  private tryToConnect() {
    if (this.peerConnection) {
      this.peerConnection.createOffer()
        .then(offer => this.peerConnection!.setLocalDescription(offer))
        .then(() => {
          this.socket!.emit('offer', this.peerConnection!.localDescription!.toJSON())
        })
    }
  }
  private connectToNewRoom() {
    AsyncStorage.setItem('room', this.state.room).then(() => {
      if (this.socket) {
        this.socket.disconnect()
      }
      this.connect()
    })
  }
  private connect() {
    this.socket = io(baseUrl, { query: { room: this.state.room } })
    this.socket.on('copy', (data: TextData | ArrayBufferData | Base64Data) => {
      if (data.kind === DataKind.file) {
        const array = new Uint8Array(data.value)
        this.state.acceptMessages.unshift({
          kind: DataKind.base64,
          value: uint8ArrayToBase64(array),
          name: data.name,
          type: data.type,
          moment: Date.now(),
          id: this.id++
        })
        this.setState({ acceptMessages: this.state.acceptMessages })
        notify(gotFileMessage)
      } else if (data.kind === DataKind.base64) {
        this.state.acceptMessages.unshift({
          kind: DataKind.base64,
          value: data.value,
          name: data.name,
          type: data.type,
          moment: Date.now(),
          id: this.id++
        })
        this.setState({ acceptMessages: this.state.acceptMessages })
        notify(gotFileMessage)
      } else {
        data.moment = Date.now()
        data.id = this.id++
        this.state.acceptMessages.unshift(data)
        this.setState({ acceptMessages: this.state.acceptMessages })
        notify('You got a text message!')
      }
    })
    this.socket.on('message_sent', (data: { kind: DataKind }) => {
      this.state.acceptMessages.unshift({
        kind: DataKind.text,
        value: `the ${data.kind} is sent successfully to ${this.state.clientCount} clients.`,
        moment: Date.now(),
        id: this.id++
      })
      this.setState({ acceptMessages: this.state.acceptMessages })
    })
    this.socket.on('client_count', (data: { clientCount: number }) => {
      this.setState({ clientCount: data.clientCount })
    })
    if (supportWebRTC) {
      this.socket.on('offer', (data: { sid: string, offer: Description }) => {
        const offer = new RTCSessionDescription(data.offer)
        this.peerConnection!.setRemoteDescription(offer)
          .then(() => this.peerConnection!.createAnswer())
          .then(answer => this.peerConnection!.setLocalDescription(answer))
          .then(() => {
            this.socket!.emit('answer', {
              sid: data.sid,
              answer: this.peerConnection!.localDescription!.toJSON()
            })
          })
      })
      this.socket.on('answer', (data: { sid: string, answer: Description }) => {
        const answer = new RTCSessionDescription(data.answer)
        this.peerConnection!.setRemoteDescription(answer)
      })
    }
  }
  private copyText() {
    if (this.state.clientCount <= 0) {
      this.state.acceptMessages.unshift({
        kind: DataKind.text,
        value: 'No clients to sent.',
        moment: Date.now(),
        id: this.id++
      })
      this.setState({ acceptMessages: this.state.acceptMessages })
      return
    }
    if (!this.state.newText) {
      this.state.acceptMessages.unshift({
        kind: DataKind.text,
        value: 'No text to sent.',
        moment: Date.now(),
        id: this.id++
      })
      this.setState({ acceptMessages: this.state.acceptMessages })
      return
    }
    const copyData: CopyData = {
      kind: DataKind.text,
      value: this.state.newText
    }
    this.socket!.emit('copy', copyData)
    this.setState({ newText: '' })
  }
  private copyTextToClipboard(text: string) {
    Clipboard.setString(text)
  }
  private pickFile() {
    if (this.state.clientCount <= 0) {
      this.state.acceptMessages.unshift({
        kind: DataKind.text,
        value: 'No clients to sent.',
        moment: Date.now(),
        id: this.id++
      })
      this.setState({ acceptMessages: this.state.acceptMessages })
      return
    }

    DocumentPicker.show({
      filetype: [DocumentPickerUtil.allFiles()]
    }, (error, res) => {
      if (error) {
        console.error(error)
      } else {
        const extensionName = res.type.split('/')[1]
        const fileName = res.fileName || `no name.${extensionName}`

        if (this.state.dataChannelIsOpen) {
          RNFS.readFile(res.uri, 'base64').then(file => {
            const binary = base64.decode(file)
            const uint8Array = new Uint8Array(new ArrayBuffer(binary.length))
            for (let i = 0; i < binary.length; i++) {
              uint8Array[i] = binary.charCodeAt(i)
            }
            const splitFile = new SplitFile()
            const messageBlocks = splitFile.split(uint8Array, fileName)
            blocks.push(...messageBlocks)
          })
        } else {
          if (res.fileSize >= 10 * 1024 * 1024) {
            this.state.acceptMessages.unshift({
              kind: DataKind.text,
              value: 'the file is too large(>= 10MB).',
              moment: Date.now(),
              id: this.id++
            })
            this.setState({ acceptMessages: this.state.acceptMessages })
            return
          }

          RNFS.readFile(res.uri, 'base64').then(file => {
            this.socket!.emit('copy', {
              kind: DataKind.base64,
              value: file,
              name: fileName,
              type: res.type
            })
          })
        }
      }
    })
  }
  private downloadFile(message: Base64Data) {
    const filepath = (Platform.OS === 'android' ? RNFS.ExternalStorageDirectoryPath : RNFS.DocumentDirectoryPath) + '/' + message.name
    RNFS.writeFile(filepath, message.value, 'base64').then((success) => {
      console.log(`file: ${filepath}`)
    })
  }
}

interface CopyData {
  kind: DataKind.text,
  value: string
}

const enum DataKind {
  text = 'text',
  file = 'file',
  base64 = 'base64'
}

interface TextData {
  kind: DataKind.text;
  value: string;
  moment: number;
  id?: number;
}

interface ArrayBufferData {
  kind: DataKind.file;
  value: ArrayBuffer;
  name: string;
  type: string;
}

interface Base64Data {
  kind: DataKind.base64;
  value: string;
  name: string;
  type?: string;
  moment: number;
  id: number;
}

interface Block {
  fileName: string;
  blocks: {
    currentBlockIndex: number,
    binary: Uint8Array
  }[];
  progress: number,
}

interface Description {
  type: 'offer' | 'answer',
  sdp: string
}
