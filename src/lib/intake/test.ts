// Simple test file to verify the intake flow works
import { createSession, getSession, clearAllSessions } from './state';
import { processIntakeMessage } from './langgraph';

export async function testIntakeFlow() {
  console.log('🧪 Testing Intake Flow...');
  
  // Clear any existing sessions
  clearAllSessions();
  
  // Create a test session
  const session = createSession('test-session-123');
  console.log('✅ Created session:', session.sessionId);
  
  try {
    // Test full name
    console.log('\n📝 Testing full name...');
    const nameResult = await processIntakeMessage('test-session-123', 'John Doe');
    console.log('Response:', nameResult.utterance);
    console.log('Current step:', nameResult.current_step);
    console.log('Progress:', nameResult.progress);
    
    // Test date of birth
    console.log('\n📅 Testing date of birth...');
    const dobResult = await processIntakeMessage('test-session-123', '1990-05-15');
    console.log('Response:', dobResult.utterance);
    console.log('Current step:', dobResult.current_step);
    console.log('Progress:', dobResult.progress);
    
    // Test phone number
    console.log('\n📞 Testing phone number...');
    const phoneResult = await processIntakeMessage('test-session-123', '+1 555 123 4567');
    console.log('Response:', phoneResult.utterance);
    console.log('Current step:', phoneResult.current_step);
    console.log('Progress:', phoneResult.progress);
    
    // Test visit reason
    console.log('\n🏥 Testing visit reason...');
    const reasonResult = await processIntakeMessage('test-session-123', 'I have been experiencing chest pain for the past week');
    console.log('Response:', reasonResult.utterance);
    console.log('Current step:', reasonResult.current_step);
    console.log('Progress:', reasonResult.progress);
    
    // Test documents (skip)
    console.log('\n📄 Testing documents (skip)...');
    const docsResult = await processIntakeMessage('test-session-123', 'skip');
    console.log('Response:', docsResult.utterance);
    console.log('Current step:', docsResult.current_step);
    console.log('Progress:', docsResult.progress);
    
    // Test review
    console.log('\n📋 Testing review...');
    const reviewResult = await processIntakeMessage('test-session-123', 'review');
    console.log('Response:', reviewResult.utterance);
    console.log('Current step:', reviewResult.current_step);
    console.log('Progress:', reviewResult.progress);
    
    // Test completion
    console.log('\n✅ Testing completion...');
    const completeResult = await processIntakeMessage('test-session-123', 'done');
    console.log('Response:', completeResult.utterance);
    console.log('Current step:', completeResult.current_step);
    console.log('Progress:', completeResult.progress);
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Test validation errors
export async function testValidationErrors() {
  console.log('\n🧪 Testing Validation Errors...');
  
  clearAllSessions();
  const session = createSession('test-validation-123');
  
  try {
    // Test invalid name
    console.log('\n❌ Testing invalid name...');
    const invalidName = await processIntakeMessage('test-validation-123', '123');
    console.log('Response:', invalidName.utterance);
    console.log('Requires correction:', invalidName.requires_correction);
    
    // Test invalid date
    console.log('\n❌ Testing invalid date...');
    const invalidDate = await processIntakeMessage('test-validation-123', 'invalid-date');
    console.log('Response:', invalidDate.utterance);
    console.log('Requires correction:', invalidDate.requires_correction);
    
    // Test invalid phone
    console.log('\n❌ Testing invalid phone...');
    const invalidPhone = await processIntakeMessage('test-validation-123', 'abc');
    console.log('Response:', invalidPhone.utterance);
    console.log('Requires correction:', invalidPhone.requires_correction);
    
    console.log('\n✅ Validation error tests completed!');
    
  } catch (error) {
    console.error('❌ Validation test failed:', error);
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  testIntakeFlow().then(() => testValidationErrors());
}
