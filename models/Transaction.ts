export class TransactionOut {
  amount: number = 0;
  keyImage: string = '';
  outputIdx: number = 0;
  globalIndex: number = 0;
  type: string = '';
  term: number = 0;

  ephemeralPub: string = '';
  pubKey: string = '';
  rtcOutPk: string = '';
  rtcMask: string = '';
  rtcAmount: string = '';
}

export class TransactionIn {
  outputIndex: number = -1;
  keyImage: string = '';
  //if < 0, means the in has been seen but not checked (view only wallet)
  amount: number = 0;
  type: string = '';
  term: number = 0;

  static fromRaw = (raw: any) => {
    let nin = new TransactionIn();
    nin.outputIndex = raw.outputIndex;
    nin.keyImage = raw.keyImage;
    nin.amount = raw.amount;
    nin.type = raw.type;
    nin.term = raw.term;
    return nin;
  };
}

export class Transaction {
  blockHeight: number = 0;
  txPubKey: string = '';
  hash: string = '';

  outs: TransactionOut[] = [];
  ins: TransactionIn[] = [];

  timestamp: number = 0;
  paymentId: string = '';
  fees: number = 0;
  fusion: boolean = false;
  message: string = '';
  extraType: string = '';
  extraStatus: string = '';
  extraSharedKey: string = '';  //encrypted
  messageViewed: boolean = false;
  ttl: number = 0; // TTL timestamp (absolute UNIX timestamp in seconds)
}

export class SharedKey extends Transaction {
  timeStampSharedKeyCreate: number = 0;
  timeStampSharedKeyRevoke: number = 0;
  sharedKeySaved: boolean = false;     //becomes true when saved to blockchain (vault icon)
}