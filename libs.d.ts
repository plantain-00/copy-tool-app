declare module "react-native-qrcode" {
    export default class QRCode extends React.Component<QRCodeProperties> { }

    interface QRCodeProperties {
        value?: string;
        size?: number;
        bgColor?: string;
        fgColor?: string;
    }
}
