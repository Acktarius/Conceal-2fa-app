/**
 *	   Copyright (c) 2018, Gnock
 *     Copyright (c) 2018-2020, ExploShot
 *     Copyright (c) 2018-2020, The Qwertycoin Project
 *     Copyright (c) 2018-2020, The Masari Project
 *     Copyright (c) 2014-2018, MyMonero.com
 *     Copyright (c) 2022 - 2025, Conceal Devs
 *     Copyright (c) 2022 - 2025, Conceal Network
 *
 *     All rights reserved.
 *     Redistribution and use in source and binary forms, with or without modification,
 *     are permitted provided that the following conditions are met:
 *
 *     ==> Redistributions of source code must retain the above copyright notice,
 *         this list of conditions and the following disclaimer.
 *     ==> Redistributions in binary form must reproduce the above copyright notice,
 *         this list of conditions and the following disclaimer in the documentation
 *         and/or other materials provided with the distribution.
 *     ==> Neither the name of Qwertycoin nor the names of its contributors
 *         may be used to endorse or promote products derived from this software
 *          without specific prior written permission.
 *
 *     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *     "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *     LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 *     A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 *     CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *     EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 *     PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *     PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *     LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *     NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *     SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import { Currency } from './Currency';
import { config } from '../config';

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
  ttl: number = 0;

  static fromRaw(raw: any) {
    let tx = new Transaction();
    tx.blockHeight = raw.blockHeight;
    tx.txPubKey = raw.txPubKey;
    tx.hash = raw.hash;
    tx.timestamp = raw.timestamp;
    tx.paymentId = raw.paymentId || '';
    tx.fees = raw.fees || 0;
    tx.fusion = raw.fusion || false;
    tx.message = raw.message || '';
    tx.extraType = raw.extraType || '';
    tx.extraStatus = raw.extraStatus || '';
    tx.extraSharedKey = raw.extraSharedKey || '';
    tx.messageViewed = raw.messageViewed || false;
    tx.ttl = raw.ttl || 0;
    tx.outs = raw.outs || [];
    tx.ins = raw.ins || [];
    return tx;
  }

  getAmount = () => {
    let amount = 0;
    for (let out of this.outs) {
      if (out.type !== "03") {
        amount += out.amount;
      }      
    }
    for (let nin of this.ins) {
      if (nin.type !== "03") {
        amount -= nin.amount;
      }      
    }
    return amount;
  }

  isCoinbase = () => {
      return this.outs.length == 1 && this.outs[0].rtcAmount === '';
  }

  isConfirmed = (blockchainHeight: number) => {
    if (this.blockHeight === 0) {
      return false;
    } else if (this.isCoinbase() && this.blockHeight + config.txCoinbaseMinConfirms < blockchainHeight) {
      return true;
    } else if (!this.isCoinbase() && this.blockHeight + config.txMinConfirms < blockchainHeight) {
      return true;
    }
    
    return false;
  }

  isFullyChecked = () => {
    if (this.getAmount() === 0 || this.getAmount() === (-1 * config.minimumFee_V2)) {
      if (this.isFusion) {
        return true;
      } else if (this.ttl > 0) {
        return true;
      } else {
        return false;
      }
    } else {
      for (let input of this.ins) {
        if (input.amount < 0) {
          return false;
        }
      }
      return true;
    }
  }

  hasMessage = () => {
    let txAmount = this.getAmount();
    return (this.message !== '') && (txAmount > 0) && (txAmount !== (1 * config.remoteNodeFee)) && (txAmount !== (10 * config.remoteNodeFee)); // no envelope for a suspectedremote node fee transaction
  }

  get isDeposit() {
    // Check if any of the outputs has a type "03", which indicates it's a deposit transaction
    return this.outs.some(out => out.type === "03");
  }

  get isWithdrawal() {
    // Check if any of the inputs has a type "03", which indicates it's a withdrawal transaction
    return this.ins.some(input => input.type === "03");
  }

  get isFusion() {
    let outputsCount = this.outs.length;
    let inputsCount = this.ins.length;
    if (this.outs.some(out => out.type === "03") || this.ins.some(input => input.type === "03")) {
      return false;
    }
    return (((inputsCount > Currency.fusionTxMinInputCount) && ((inputsCount / outputsCount) > config.fusionTxMinInOutCountRatio)) || this.fusion);
  }

  export() {
    return {
      blockHeight: this.blockHeight,
      txPubKey: this.txPubKey,
      hash: this.hash,
      timestamp: this.timestamp,
      paymentId: this.paymentId,
      fees: this.fees,
      fusion: this.fusion,
      message: this.message,
      extraType: this.extraType,
      extraStatus: this.extraStatus,
      extraSharedKey: this.extraSharedKey,
      messageViewed: this.messageViewed,
      ttl: this.ttl,
      outs: this.outs,
      ins: this.ins
    };
  }

  copy() {
    let tx = new Transaction();
    tx.blockHeight = this.blockHeight;
    tx.txPubKey = this.txPubKey;
    tx.hash = this.hash;
    tx.timestamp = this.timestamp;
    tx.paymentId = this.paymentId;
    tx.fees = this.fees;
    tx.fusion = this.fusion;
    tx.message = this.message;
    tx.extraType = this.extraType;
    tx.extraStatus = this.extraStatus;
    tx.extraSharedKey = this.extraSharedKey;
    tx.messageViewed = this.messageViewed;
    tx.ttl = this.ttl;
    tx.ins = [...this.ins];
    tx.outs = [...this.outs];
    return tx;
  }
}

class BaseBanking {
  term: number = 0;
  txHash: string = '';
  amount: number = 0;
  interest: number = 0;
  timestamp: number = 0;
  blockHeight: number = 0;
  unlockHeight: number = 0;
  globalOutputIndex: number = 0;
  indexInVout: number = 0;
  txPubKey: string = '';

  static fromRaw(raw: any) {
    let deposit = new Deposit();
    deposit.term = raw.term;
    deposit.txHash = raw.txHash;
    deposit.amount = raw.amount;
    deposit.interest = raw.interest;
    deposit.timestamp = raw.timestamp;
    deposit.blockHeight = raw.blockHeight;
    deposit.unlockHeight = raw.unlockHeight || (raw.blockHeight + raw.term);
    deposit.globalOutputIndex = raw.globalOutputIndex;
    deposit.indexInVout = raw.indexInVout;
    deposit.txPubKey = raw.txPubKey;

    return deposit;
  }

  export() {
    return {
      term: this.term,
      txHash: this.txHash,
      amount: this.amount,
      interest: this.interest,
      timestamp: this.timestamp,
      blockHeight: this.blockHeight,
      unlockHeight: this.unlockHeight,
      globalOutputIndex: this.globalOutputIndex,
      indexInVout: this.indexInVout,
      txPubKey: this.txPubKey
    };
  }

  copy() { 
    let aCopy = new Deposit();

    aCopy.term = this.term;
    aCopy.txHash = this.txHash;
    aCopy.amount = this.amount;
    aCopy.interest = this.interest;
    aCopy.timestamp = this.timestamp;
    aCopy.blockHeight = this.blockHeight;
    aCopy.unlockHeight = this.unlockHeight;
    aCopy.globalOutputIndex = this.globalOutputIndex;
    aCopy.indexInVout = this.indexInVout;
    aCopy.txPubKey = this.txPubKey;
  
    return aCopy;
  }
}

export class Deposit extends BaseBanking {
  spentTx: string = '';
  keys: string[] = []; // Array of public keys for multisignature deposit
  withdrawPending: boolean = false;
  
  static fromRaw(raw: any) {
    let deposit = new Deposit();
    deposit.term = raw.term;
    deposit.txHash = raw.txHash;
    deposit.amount = raw.amount;
    deposit.interest = raw.interest;
    deposit.spentTx = raw.spentTx; 
    deposit.timestamp = raw.timestamp;
    deposit.blockHeight = raw.blockHeight;
    deposit.globalOutputIndex = raw.globalOutputIndex;      //used to build Multisig input for withdrawals
    deposit.indexInVout = raw.indexInVout;                  //used to generate_signature for withdrawals
    deposit.txPubKey = raw.txPubKey;
    deposit.unlockHeight = raw.unlockHeight || (raw.blockHeight + raw.term);
    deposit.keys = raw.keys || [];
    deposit.withdrawPending = raw.withdrawPending;
    return deposit;
  }

  export() {
    return Object.assign(super.export(), {
      spentTx: this.spentTx,
      withdrawPending: this.withdrawPending,
      keys: this.keys
    });
  }

  copy = () => { 
    let aCopy = super.copy();  
    aCopy.spentTx = this.spentTx;
    aCopy.withdrawPending = this.withdrawPending;
    aCopy.keys = [...this.keys];
    return aCopy;
  }
  
  // Get total amount (principal + interest)
  getTotalAmount(): number {
    return this.amount + this.interest;
  }
  
  // Check if deposit is unlocked at current height
  isUnlocked(currentHeight: number): boolean {
    return currentHeight >= this.unlockHeight;
  }
  
  // Check if deposit has been spent
  isSpent(): boolean {
    return !!this.spentTx;
  }
  
  // Get deposit status
  getStatus(currentHeight: number): 'Locked' | 'Unlocked' | 'Spent' {
    if (this.isSpent()) {
      return 'Spent';
    } else if (this.isUnlocked(currentHeight)) {
      return 'Unlocked';
    } else {
      return 'Locked';
    }
  }
  
}

export class Withdrawal extends BaseBanking {}

export class TransactionData {
  transaction: Transaction | null = null;
  withdrawals: Deposit[] = [];
  deposits: Deposit[] = [];

  static fromRaw = (raw: any) =>  {
    let txData = new TransactionData();
    txData.transaction = Transaction.fromRaw(raw.transaction);

    if (raw.withdrawals) {
      for (let withdrawal of raw.withdrawals) {
        txData.withdrawals.push(Deposit.fromRaw(withdrawal));
      }
    }

    if (raw.deposits) {
      for (let deposit  of raw.deposits) {
        txData.deposits.push(Deposit.fromRaw(deposit));
      }
    }

    return txData;
  }

  export = () => {
    let txData: any = {};
    let deposits: any[] = [];
    let withdrawals: any[] = [];

    if (this.transaction) {
      txData.transaction = this.transaction.export();
    }

    if (this.deposits.length > 0) {
      for (let deposit of this.deposits) {
        deposits.push(deposit.export());
      }
    }

    if (this.withdrawals.length > 0) {
      for (let withdrawal of this.withdrawals) {
        withdrawals.push(withdrawal.export());
      }
    }    

    txData.deposits = deposits;
    txData.withdrawals = withdrawals;

    return txData;
  }

  copy = () => { 
    let aCopy = new TransactionData();
    aCopy.transaction = this.transaction ? this.transaction.copy() : null;

    for (let deposit of this.deposits) {
      aCopy.deposits.push(deposit.copy());
    }
    for (let withdrawal of this.withdrawals) {
      aCopy.withdrawals.push(withdrawal.copy());
    }

    return aCopy;
  }
}

export class SharedKey extends Transaction {
  timeStampSharedKeyCreate: number = 0;
  timeStampSharedKeyRevoke: number = -1;
  sharedKeySaved: boolean = false;     //becomes true when saved to blockchain (chain icon)
  
  // 2FA specific properties
  name: string = '';
  issuer: string = '';
  secret: string = '';
  code: string = '';
  timeRemaining: number = 0;
  revokeInQueue: boolean = false;
  toBePush: boolean = false; // Flag to indicate if shared key needs to be pushed to blockchain
  unknownSource: boolean = false; // Flag to indicate if shared key comes from unknown source
  isLocal: boolean = true; // Flag to indicate if shared key is local-only (not on blockchain)
  
  static fromRaw(serviceData: { name: string; issuer: string; secret: string }): SharedKey {
    const sharedKey = new SharedKey();
    sharedKey.name = serviceData.name;
    sharedKey.issuer = serviceData.issuer;
    sharedKey.secret = serviceData.secret;
    sharedKey.timeStampSharedKeyCreate = Date.now();
    sharedKey.hash = ''; // Ensure it starts as local
    sharedKey.revokeInQueue = false; // Ensure it's not in revoke queue
    sharedKey.toBePush = true; // New shared keys need to be pushed to blockchain
    sharedKey.unknownSource = false; // User-created services are trusted by default
    sharedKey.isLocal = true; // User-created services start as local
    return sharedKey;
  }
  
  static fromBlockchain(txData: any): SharedKey {
    const sharedKey = new SharedKey();
    sharedKey.hash = txData.hash;
    sharedKey.blockHeight = txData.blockHeight;
    sharedKey.timestamp = txData.timestamp;
    sharedKey.sharedKeySaved = true;
    sharedKey.isLocal = false; // Blockchain-imported services are not local
    
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
  
  isLocalOnly(): boolean {
    return this.isLocal;
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