declare module "react-native-document-picker" {
    var DocumentPicker: {
        show(options: Options, callback: (error: Error, result: Result) => void): void;
    };
    var DocumentPickerUtil: {
        allFiles(): string;
        pdf(): string;
        audio(): string;
        plainText(): string;
    };
}

interface Options {
    top?: number;
    left?: number;
    filetype: string[];
}

interface Result {
    uri: string;
    type: string;
    fileName: string;
    fileSize: number;
}
