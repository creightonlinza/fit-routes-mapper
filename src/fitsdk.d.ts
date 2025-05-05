declare module '@garmin/fitsdk' {
  export class Decoder {
    constructor(stream: Stream);
    read(options: { mesgListener: (messageNumber: string | number, message: any) => void }): void;
  }

  export class Stream {
    static fromArrayBuffer(buffer: string | ArrayBuffer | null): Stream;
  }

  export const Profile: {
    types: {
      mesgNum: { [key: string]: string };
    };
  };
}
