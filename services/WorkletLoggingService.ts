/*
 * Copyright (c) 2025 Acktarius, Conceal Devs
 * 
 * This file is part of Conceal-2FA-App
 * 
 * Distributed under the BSD 3-Clause License, see the accompanying
 * file LICENSE or https://opensource.org/licenses/BSD-3-Clause.
 */
import { createWorkletRuntime, scheduleOnRuntime } from 'react-native-worklets';
import { type IWorkletLogging, setGlobalWorkletLogging } from './interfaces/IWorkletLogging';

export class WorkletLoggingService implements IWorkletLogging {
  public readonly runtime: any;

  constructor() {
    this.runtime = createWorkletRuntime({ name: 'logging-background' });
  }

  logging1string(message: string): void {
    scheduleOnRuntime(this.runtime, () => {
      console.log(message);
    });
  }

  logging2string(message1: string, message2: string): void {
    scheduleOnRuntime(this.runtime, () => {
      console.log(message1, message2);
    });
  }

  logging2numbers(num1: number, num2: number): void {
    scheduleOnRuntime(this.runtime, () => {
      console.log(num1, num2);
    });
  }

  logging1string1number(message: string, num: number): void {
    scheduleOnRuntime(this.runtime, () => {
      console.log(message, num);
    });
  }

  loggingWithString(template: string, variable: string): void {
    scheduleOnRuntime(this.runtime, (varValue: string) => {
      console.log(template.replace('{}', varValue));
    }, variable);
  }

  loggingWithNumber(template: string, variable: number): void {
    scheduleOnRuntime(this.runtime, (varValue: number) => {
      console.log(template.replace('{}', varValue.toString()));
    }, variable);
  }


  loggingWith_s_d(template: string, variable1: any, variable2: any): void {
    scheduleOnRuntime(this.runtime, (varValue1: any, varValue2: any) => {
      const formattedMessage = template.replace('%s', varValue1.toString()).replace('%d', varValue2.toString());
      console.log(formattedMessage);
    }, variable1, variable2);
  }


}

/**
 * Initialize the global worklet logging service
 */
export function initializeGlobalWorkletLogging(): void {
  const loggingService = new WorkletLoggingService();
  setGlobalWorkletLogging(loggingService);
}
