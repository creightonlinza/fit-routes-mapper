declare module '@garmin/fitsdk' {
  export class Decoder {
    constructor(stream: Stream);
    read(options: {
      mesgListener: (
        messageNumber: string | number,
        message: import('./app/model/record-message.model').RecordMessage
      ) => void;
    }): { errors?: unknown[] };
  }

  export class Stream {
    static fromArrayBuffer(buffer: string | ArrayBuffer | null): Stream;
  }

  export const Profile: {
    types: {
      mesgNum: Record<string, string>;
    };
  };
}
