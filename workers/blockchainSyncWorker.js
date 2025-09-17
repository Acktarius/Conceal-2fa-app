import { self } from 'react-native-threads';

// This worker thread handles blockchain synchronization
// It receives commands from the main thread and processes blocks/transactions

let isRunning = false;
let currentHeight = 0;
let targetHeight = 0;
let processedBlocks = 0;

self.onmessage = (message) => {
  try {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'start':
        startSync(data.payload);
        break;
      case 'stop':
        stopSync();
        break;
      case 'updateHeight':
        updateTargetHeight(data.payload.targetHeight);
        break;
      case 'status':
        sendStatus();
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  } catch (error) {
    console.error('Worker thread error:', error);
    self.postMessage(JSON.stringify({
      type: 'error',
      error: error.message
    }));
  }
};

function startSync(payload) {
  console.log('Worker: Starting blockchain sync from height:', payload.startHeight);
  currentHeight = payload.startHeight;
  targetHeight = payload.targetHeight;
  isRunning = true;
  processedBlocks = 0;
  
  // Send initial status
  sendStatus();
  
  // Start processing blocks
  processBlocks();
}

function stopSync() {
  console.log('Worker: Stopping blockchain sync');
  isRunning = false;
  
  self.postMessage(JSON.stringify({
    type: 'stopped',
    processedBlocks: processedBlocks
  }));
}

function updateTargetHeight(newTargetHeight) {
  targetHeight = newTargetHeight;
  console.log('Worker: Updated target height to:', targetHeight);
}

function processBlocks() {
  if (!isRunning) return;
  
  // Simulate block processing (in real implementation, this would fetch and process actual blocks)
  const blocksToProcess = Math.min(100, targetHeight - currentHeight);
  
  if (blocksToProcess > 0) {
    // Simulate processing time
    setTimeout(() => {
      currentHeight += blocksToProcess;
      processedBlocks += blocksToProcess;
      
      // Send progress update
      self.postMessage(JSON.stringify({
        type: 'progress',
        currentHeight: currentHeight,
        targetHeight: targetHeight,
        processedBlocks: processedBlocks,
        isComplete: currentHeight >= targetHeight
      }));
      
      // Continue processing if not complete
      if (currentHeight < targetHeight && isRunning) {
        processBlocks();
      } else if (currentHeight >= targetHeight) {
        // Sync complete
        self.postMessage(JSON.stringify({
          type: 'complete',
          finalHeight: currentHeight,
          totalProcessed: processedBlocks
        }));
        isRunning = false;
      }
    }, 100); // Simulate 100ms processing time
  }
}

function sendStatus() {
  self.postMessage(JSON.stringify({
    type: 'status',
    isRunning: isRunning,
    currentHeight: currentHeight,
    targetHeight: targetHeight,
    processedBlocks: processedBlocks
  }));
}

// Handle thread termination
self.onterminate = () => {
  console.log('Worker: Thread terminating');
  isRunning = false;
};
