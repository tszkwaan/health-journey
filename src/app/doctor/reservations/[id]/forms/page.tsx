"use client";
import { useState, useEffect } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: any[];
}

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'clinician_summary',
    name: 'Clinician Summary',
    description: 'Comprehensive medical summary for healthcare providers',
    fields: [
      { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'mrn', label: 'Medical Record Number', type: 'text', required: true },
      { name: 'dateOfVisit', label: 'Date of Visit', type: 'date', required: true },
      { name: 'provider', label: 'Provider', type: 'text', required: true },
      { name: 'chiefComplaint', label: 'Chief Complaint', type: 'textarea', required: true },
      { name: 'historyOfPresentIllness', label: 'History of Present Illness', type: 'textarea', required: true },
      { name: 'pastMedicalHistory', label: 'Past Medical History', type: 'textarea', required: false },
      { name: 'medications', label: 'Current Medications', type: 'textarea', required: false },
      { name: 'allergies', label: 'Allergies', type: 'textarea', required: false },
      { name: 'socialHistory', label: 'Social History', type: 'textarea', required: false },
      { name: 'physicalExam', label: 'Physical Examination', type: 'textarea', required: false },
      { name: 'assessment', label: 'Assessment', type: 'textarea', required: true },
      { name: 'plan', label: 'Plan', type: 'textarea', required: true },
      { name: 'followUp', label: 'Follow-Up Plan', type: 'textarea', required: false },
      { name: 'signature', label: 'Provider Signature', type: 'signature', required: true }
    ]
  },
  {
    id: 'patient_summary',
    name: 'Patient Summary',
    description: 'Patient-friendly summary with medications and care instructions',
    fields: [
      { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'diagnosis', label: 'Your Diagnosis', type: 'textarea', required: true },
      { name: 'medications', label: 'Your Medications', type: 'textarea', required: false },
      { name: 'instructions', label: 'Medication Instructions', type: 'textarea', required: false },
      { name: 'homeCare', label: 'Home Care Instructions', type: 'textarea', required: true },
      { name: 'recovery', label: 'Recovery Instructions', type: 'textarea', required: true },
      { name: 'followUp', label: 'Follow-Up Plan', type: 'textarea', required: true },
      { name: 'warningSigns', label: 'Warning Signs to Watch For', type: 'textarea', required: true },
      { name: 'whenToSeekHelp', label: 'When to Seek Help', type: 'textarea', required: true },
      { name: 'contactInfo', label: 'Contact Information', type: 'textarea', required: true }
    ]
  }
];

export default function FormsPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const reservationId = params.id as string;
  const transcript = searchParams.get('transcript') || '';

  const [selectedForms, setSelectedForms] = useState<string[]>(['clinician_summary', 'patient_summary']); // Both forms mandatory
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedForms, setGeneratedForms] = useState<Record<string, any>>({});
  const [formUpdates, setFormUpdates] = useState<Record<string, any>>({});
  const [generationStatus, setGenerationStatus] = useState<Record<string, 'pending' | 'generating' | 'completed' | 'error'>>({});
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Initialize WebSocket connection for form generation updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/api/forms/ws?reservationId=${reservationId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connected for form generation');
      setWsConnection(ws);
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'form_generated') {
        setGeneratedForms(prev => ({ ...prev, [data.formId]: data.formData }));
        setGenerationStatus(prev => ({ ...prev, [data.formId]: 'completed' }));
        
        // If this is the currently selected form, update the form data
        if (selectedForm === data.formId) {
          const savedUpdates = formUpdates[data.formId] || {};
          setFormData({ ...data.formData, ...savedUpdates });
        }
      } else if (data.type === 'form_generation_error') {
        setGenerationStatus(prev => ({ ...prev, [data.formId]: 'error' }));
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnection(null);
    };
    
    return () => {
      ws.close();
    };
  }, [reservationId, selectedForm, formUpdates]);

  // Load existing forms and auto-generate on component mount
  useEffect(() => {
    if (transcript) {
      loadExistingForms();
      generateAllForms();
    }
  }, [transcript]);

  // Load existing forms from database
  const loadExistingForms = async () => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`);
      if (response.ok) {
        const forms = await response.json();
        const existingForms: Record<string, any> = {};
        const existingStatus: Record<string, 'completed'> = {};
        
        forms.forEach((form: any) => {
          existingForms[form.formType] = form.formData;
          existingStatus[form.formType] = 'completed';
        });
        
        setGeneratedForms(existingForms);
        setGenerationStatus(existingStatus);
        
        // If no form is selected, select the first available form
        if (!selectedForm && forms.length > 0) {
          setSelectedForm(forms[0].formType);
        }
      }
    } catch (error) {
      console.error('Error loading existing forms:', error);
    }
  };

  // Generate all forms
  const generateAllForms = async () => {
    const formTemplates = ['clinician_summary', 'patient_summary'];
    
    // Set all forms to generating status
    const initialStatus = formTemplates.reduce((acc, formId) => {
      acc[formId] = 'generating';
      return acc;
    }, {} as Record<string, 'generating'>);
    setGenerationStatus(initialStatus);
    
    // Generate forms in parallel
    formTemplates.forEach(async (formId) => {
      try {
        const response = await fetch('/api/forms/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formId,
            transcript,
            reservationId
          })
        });

        if (response.ok) {
          const data = await response.json();
          setGeneratedForms(prev => ({ ...prev, [formId]: data }));
          setGenerationStatus(prev => ({ ...prev, [formId]: 'completed' }));
          
          // Store form in database
          await storeFormInDatabase(formId, data);
        } else {
          setGenerationStatus(prev => ({ ...prev, [formId]: 'error' }));
        }
      } catch (error) {
        console.error(`Error generating form ${formId}:`, error);
        setGenerationStatus(prev => ({ ...prev, [formId]: 'error' }));
      }
    });
  };

  // Store form in database
  const storeFormInDatabase = async (formId: string, formData: any) => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: formId,
          formData: formData,
          isGenerated: true
        })
      });
      
      if (!response.ok) {
        console.error('Failed to store form in database');
      }
    } catch (error) {
      console.error('Error storing form in database:', error);
    }
  };

  // Generate form data using LLM (legacy function for manual generation)
  const generateFormData = async (formType: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: formType,
          transcript,
          reservationId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedForms(prev => ({ ...prev, [formType]: data }));
        setFormData(prev => ({ ...prev, ...data }));
      } else {
        console.error('Failed to generate form data');
      }
    } catch (error) {
      console.error('Error generating form data:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert complex objects to readable strings
  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return Object.entries(item)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
        }
        return String(item);
      }).join('\n');
    }
    
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([key, val]) => `${key}: ${val}`)
        .join('\n');
    }
    
    return String(value);
  };

  // Handle form selection (both forms are mandatory, so just show the selected form)
  const handleFormSelection = (formId: string) => {
    // Both forms are always selected, just show the selected form
    setSelectedForm(formId);
  };


  // Handle form name click (view/edit form)
  const handleFormNameClick = (formId: string) => {
    setSelectedForm(formId);
  };

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Save updates to preserve when switching forms
    if (selectedForm) {
      setFormUpdates(prev => ({
        ...prev,
        [selectedForm]: {
          ...prev[selectedForm],
          [fieldName]: value
        }
      }));
    }
  };

  // Load form data when switching forms
  useEffect(() => {
    if (selectedForm) {
      // Merge generated data with saved updates
      const generatedData = generatedForms[selectedForm] || {};
      const savedUpdates = formUpdates[selectedForm] || {};
      setFormData({ ...generatedData, ...savedUpdates });
    }
  }, [selectedForm, generatedForms, formUpdates]);

  // Save forms
  const saveForms = async () => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forms: selectedForms.map(formId => ({
            formType: formId,
            formData: {
              ...generatedForms[formId],
              ...formUpdates[formId]
            }
          }))
        })
      });

      if (response.ok) {
        alert('Forms saved successfully!');
        // Navigate back to reservation page
        window.close();
      } else {
        console.error('Failed to save forms');
      }
    } catch (error) {
      console.error('Error saving forms:', error);
    }
  };

  const currentForm = selectedForm ? FORM_TEMPLATES.find(f => f.id === selectedForm) : null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Form Generation</h1>
              <p className="text-gray-600">Generate and edit forms based on consultation transcript</p>
            </div>
            <Link
              href={`/doctor/reservations/${reservationId}`}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Reservation
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Form Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Forms</h2>
                  <div className="space-y-3">
                    {FORM_TEMPLATES.map((form) => (
                      <div 
                        key={form.id} 
                        className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                          selectedForm === form.id
                            ? 'bg-purple-50 border-purple-300 shadow-sm'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        onClick={() => handleFormSelection(form.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex-1 min-w-0">
                            {/* Form name */}
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium text-gray-900">
                                {form.name}
                              </h3>
                              
                              {/* Generation status indicator */}
                              <div className="flex-shrink-0 ml-2">
                                {generationStatus[form.id] === 'generating' && (
                                  <div className="flex items-center text-xs text-blue-600">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
                                    Generating...
                                  </div>
                                )}
                                {generationStatus[form.id] === 'completed' && (
                                  <div className="flex items-center text-xs text-green-600">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Ready
                                  </div>
                                )}
                                {generationStatus[form.id] === 'error' && (
                                  <div className="flex items-center text-xs text-red-600">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Error
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{form.description}</p>
                          </div>
                          
                          {/* Selection indicator */}
                          {selectedForm === form.id && (
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-6">
                <button
                  onClick={saveForms}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors"
                >
                  Save Both Forms
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Form Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {selectedForm && currentForm ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">{currentForm.name}</h2>
                    {isGenerating && (
                      <div className="flex items-center text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
                        Generating...
                      </div>
                    )}
                  </div>

                  <form className="space-y-6">
                    {currentForm.fields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        
                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={formatFieldValue(formData[field.name])}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                        
                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={formatFieldValue(formData[field.name])}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                        
                        {field.type === 'textarea' && (
                          <textarea
                            value={formatFieldValue(formData[field.name])}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                        
                        {field.type === 'radio' && field.name === 'form' && (
                          <div className="space-y-2">
                            {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Other'].map((option) => (
                              <label key={option} className="flex items-center">
                                <input
                                  type="radio"
                                  name={field.name}
                                  value={option}
                                  checked={formatFieldValue(formData[field.name]) === option}
                                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                  className="mr-2"
                                />
                                {option}
                              </label>
                            ))}
                          </div>
                        )}
                        
                        {field.type === 'signature' && (
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <p className="text-gray-500">Digital signature area</p>
                            <p className="text-sm text-gray-400 mt-1">Sign above</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </form>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Form to Edit</h3>
                      <p className="text-gray-500">Click on either form from the left sidebar to view and edit it.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
