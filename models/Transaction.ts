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
  
  // 2FA specific properties
  name: string = '';
  issuer: string = '';
  secret: string = '';
  code: string = '';
  timeRemaining: number = 0;
  isLocalOnly: boolean = true;
  inQueue: boolean = false;
  revokeInQueue: boolean = false;
  
  static fromService(serviceData: { name: string; issuer: string; secret: string }): SharedKey {
    const sharedKey = new SharedKey();
    sharedKey.name = serviceData.name;
    sharedKey.issuer = serviceData.issuer;
    sharedKey.secret = serviceData.secret;
    sharedKey.isLocalOnly = true;
    sharedKey.timeStampSharedKeyCreate = Date.now();
    return sharedKey;
  }
  
  static fromBlockchain(txData: any): SharedKey {
    const sharedKey = new SharedKey();
    sharedKey.hash = txData.hash;
    sharedKey.blockHeight = txData.blockHeight;
    sharedKey.timestamp = txData.timestamp;
    sharedKey.isLocalOnly = false;
    sharedKey.sharedKeySaved = true;
    
    // Parse extra data (second byte indicates creation, rest contains name, issuer, secret)
    if (txData.extraType && txData.extraType.length > 1) {
      const isCreation = txData.extraType[1] === '01'; // Second byte indicates creation
      if (isCreation) {
        const extraData = txData.extraType.substring(2); // Rest contains the data
        try {
          const parsed = JSON.parse(extraData);
          sharedKey.name = parsed.name || '';
          sharedKey.issuer = parsed.issuer || '';
          sharedKey.secret = parsed.secret || '';
        } catch (error) {
          console.error('Error parsing SharedKey extra data:', error);
        }
      }
    }
    
    return sharedKey;
  }
  
  isOnBlockchain(): boolean {
    return !this.isLocalOnly && this.hash !== '';
  }
  
  getExtraData(): string {
    // Second byte '01' indicates creation, followed by JSON data
    const data = JSON.stringify({
      name: this.name,
      issuer: this.issuer,
      secret: this.secret
    });
    return '01' + data; // '01' prefix for creation type
  }
}