'use strict';

const store = require('./lib/store');
const brain = require('./lib/brain');
const training = require('./lib/training-data');

brain.attachPersistence({ load: () => store.brainMemory().get(), save: (data) => store.brainMemory().set(data) });
const result = brain.ingestTraining(training);

console.log(result.reply);
console.log(JSON.stringify(brain.status(), null, 2));
