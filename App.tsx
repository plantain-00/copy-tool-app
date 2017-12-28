import React from "react";
import { TouchableOpacity, Text, View, TextInput, AsyncStorage, Clipboard, ScrollView } from "react-native";
import io from "socket.io-client";
import { RelativeTime } from "relative-time-react-native-component";

function getRoom() {
    return Math.round(Math.random() * 35 * Math.pow(36, 9)).toString(36);
}

export default class App extends React.Component {
    state = {
        acceptMessages: [] as (TextData | FileData)[],
        newText: "",
        clientCount: 0,
        room: "",
    };
    private socket: SocketIOClient.Socket;
    private id = 1;
    componentDidMount() {
        AsyncStorage.getItem("room").then(roomInStorage => {
            if (!roomInStorage) {
                this.setState({ room: getRoom() }, () => {
                    AsyncStorage.setItem("room", this.state.room).then(() => {
                        this.connect();
                    });
                });
            } else {
                this.setState({ room: roomInStorage }, () => {
                    this.connect();
                });
            }
        });
    }
    componentWillUnmount() {
        if (this.socket) {
            this.socket.close();
        }
    }
    render() {
        const messages = this.state.acceptMessages.map(message => {
            let content: JSX.Element | undefined;
            let button: JSX.Element | undefined;
            if (message.kind === "text") {
                content = <Text style={{
                    padding: 9.5,
                    backgroundColor: "#f5f5f5",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: "#ccc",
                    borderRadius: 4,
                    marginBottom: 10,
                }}>{message.value}</Text>;
                button = <TouchableOpacity style={{
                    width: 39,
                    borderRadius: 3,
                    borderColor: "#ccc",
                    borderStyle: "solid",
                    borderWidth: 1,
                    justifyContent: "center",
                }} onPress={() => this.copyTextToClipboard(message.value)}>
                    <Text style={{ textAlign: "center" }}>copy</Text>
                </TouchableOpacity>;
            } else if (message.kind === "file") {
                // content = <a href="message.url" download="message.value.name">{message.value.name}</a>;
            }
            return (
                <View key={message.id}>
                    <View style={{ height: 21, flexDirection: "row" }}>
                        <Text style={{
                            minWidth: 67,
                            backgroundColor: "#777",
                            color: "#fff",
                            borderRadius: 3,
                            justifyContent: "center",
                            textAlign: "center",
                            paddingLeft: 7,
                            paddingRight: 7,
                        }}>
                            <RelativeTime time={message.moment}></RelativeTime>
                        </Text>
                        <Text style={{
                            width: 38,
                            backgroundColor: "#5bc0de",
                            color: "#fff",
                            borderRadius: 3,
                            justifyContent: "center",
                            textAlign: "center",
                        }}>{message.kind}</Text>
                        {button}
                    </View>
                    {content}
                </View>
            );
        });
        const buttonText = this.state.clientCount > 0 ? `Copy the text to ${this.state.clientCount} clients` : "No clients to sent";
        return (
            <ScrollView style={{ flex: 1, padding: 15 }}>
                <Text style={{ height: 40 }}>Copy-Tool</Text>
                <TextInput style={{ height: 40, width: "100%", marginBottom: 5 }}
                    placeholder="room"
                    autoCapitalize="none"
                    onChangeText={room => this.changeRoom(room)}
                    onBlur={() => this.connectToNewRoom()}
                    value={this.state.room}>
                </TextInput>
                <TextInput style={{ height: 110, marginBottom: 5 }}
                    placeholder="text message"
                    autoFocus
                    multiline
                    autoCapitalize="none"
                    numberOfLines={5}
                    onChangeText={text => this.changeNewText(text)}
                    value={this.state.newText}>
                </TextInput>
                <TouchableOpacity style={{
                    height: 40,
                    backgroundColor: "#286090",
                    justifyContent: "center",
                    marginBottom: 5,
                }} onPress={() => this.copyText()} >
                    <Text style={{
                        color: "#fff",
                        textAlign: "center",
                    }}>{buttonText}</Text>
                </TouchableOpacity>
                {messages}
            </ScrollView>
        );
    }
    private changeNewText(text: string) {
        this.setState({ newText: text });
    }
    private changeRoom(room: string) {
        this.setState({ room });
    }
    private connectToNewRoom() {
        AsyncStorage.setItem("room", this.state.room).then(() => {
            if (this.socket) {
                this.socket.disconnect();
            }
            this.connect();
        });
    }
    private connect() {
        this.socket = io("https://copy.yorkyao.xyz/", { query: { room: this.state.room } });
        this.socket.on("copy", (data: TextData | ArrayBufferData) => {
            if (data.kind === DataKind.file) {
                const file = new File([data.value], data.name, { type: data.type });
                this.state.acceptMessages.unshift({
                    kind: DataKind.file,
                    value: file,
                    url: URL.createObjectURL(file),
                    moment: Date.now(),
                    id: this.id++,
                });
                this.setState({ acceptMessages: this.state.acceptMessages });
            } else {
                data.moment = Date.now();
                data.id = this.id++;
                this.state.acceptMessages.unshift(data);
                this.setState({ acceptMessages: this.state.acceptMessages });
            }
        });
        this.socket.on("message_sent", (data: { kind: DataKind }) => {
            this.state.acceptMessages.unshift({
                kind: DataKind.text,
                value: `the ${data.kind} is sent successfully to ${this.state.clientCount} clients.`,
                moment: Date.now(),
                id: this.id++,
            });
            this.setState({ acceptMessages: this.state.acceptMessages });
        });
        this.socket.on("client_count", (data: { clientCount: number }) => {
            this.setState({ clientCount: data.clientCount });
        });
    }
    private copyText() {
        if (this.state.clientCount <= 0) {
            this.state.acceptMessages.unshift({
                kind: DataKind.text,
                value: "No clients to sent.",
                moment: Date.now(),
                id: this.id++,
            });
            this.setState({ acceptMessages: this.state.acceptMessages });
            return;
        }
        if (!this.state.newText) {
            this.state.acceptMessages.unshift({
                kind: DataKind.text,
                value: "No text to sent.",
                moment: Date.now(),
                id: this.id++,
            });
            this.setState({ acceptMessages: this.state.acceptMessages });
            return;
        }
        const copyData: CopyData = {
            kind: DataKind.text,
            value: this.state.newText,
        };
        this.socket.emit("copy", copyData);
        this.setState({ newText: "" });
    }
    private copyTextToClipboard(text: string) {
        Clipboard.setString(text);
    }
}

export type CopyData = {
    kind: DataKind.text,
    value: string,
};

const enum DataKind {
    text = "text",
    file = "file",
}

type TextData = {
    kind: DataKind.text;
    value: string;
    moment: number;
    id?: number;
};

type ArrayBufferData = {
    kind: DataKind.file;
    value: ArrayBuffer;
    name: string;
    type: string;
};

type FileData = {
    kind: DataKind.file;
    value: File;
    url: string;
    moment: number;
    id: number;
};
