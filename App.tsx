import React from "react";
import { StyleSheet, Text, View, TextInput, Button, AsyncStorage } from "react-native";
import io from "socket.io-client";

function getRoom() {
    return Math.round(Math.random() * 35 * Math.pow(36, 9)).toString(36);
}

function formatTimeNumber(num: number) {
    return num < 10 ? "0" + num : num.toString();
}

function getNow() {
    return `${formatTimeNumber(new Date().getHours())}:${formatTimeNumber(new Date().getMinutes())}:${formatTimeNumber(new Date().getSeconds())}`;
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
                content = <Text>{message.value}</Text>;
                button = <Button title="copy" onPress={() => this.copyTextToClipboard()} />;
            } else if (message.kind === "file") {
                // content = <a href="message.url" download="message.value.name">{message.value.name}</a>;
            }
            return (
                <View key={message.id}>
                    <Text>{message.moment}</Text>
                    <Text>{message.kind}</Text>
                    {content}
                    {button}
                </View>
            );
        });
        const buttonText = this.state.clientCount > 0 ? `Copy the text to ${this.state.clientCount} clients` : "No clients to sent";
        return (
            <View style={styles.container}>
                <Text style={styles.row}>Copy-Tool</Text>
                <TextInput onChangeText={room => this.changeRoom(room)} value={this.state.room}></TextInput>
                <TextInput onChangeText={text => this.changeNewText(text)} value={this.state.newText}></TextInput>
                <Button title={buttonText} onPress={() => this.copyText()} />
                {messages}
            </View>
        );
    }
    private changeNewText(text: string) {
        this.setState({ newText: text });
    }
    private changeRoom(room: string) {
        if (room !== this.state.room) {
            this.setState({ room }, () => {
                AsyncStorage.setItem("room", this.state.room).then(() => {
                    if (this.socket) {
                        this.socket.disconnect();
                    }
                    this.connect();
                });
            });
        }
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
                    moment: getNow(),
                    id: this.id++,
                });
                this.setState({ acceptMessages: this.state.acceptMessages });
            } else {
                data.moment = getNow();
                data.id = this.id++;
                this.state.acceptMessages.unshift(data);
                this.setState({ acceptMessages: this.state.acceptMessages });
            }
        });
        this.socket.on("message_sent", (data: { kind: DataKind }) => {
            this.state.acceptMessages.unshift({
                kind: DataKind.text,
                value: `the ${data.kind} is sent successfully to ${this.state.clientCount} clients.`,
                moment: getNow(),
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
                moment: getNow(),
                id: this.id++,
            });
            this.setState({ acceptMessages: this.state.acceptMessages });
            return;
        }
        if (!this.state.newText) {
            this.state.acceptMessages.unshift({
                kind: DataKind.text,
                value: "No text to sent.",
                moment: getNow(),
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
    private copyTextToClipboard() {
        // todo
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
    },
    row: {
        marginTop: 5,
    },
});

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
    moment?: string;
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
    moment: string;
    id: number;
};
