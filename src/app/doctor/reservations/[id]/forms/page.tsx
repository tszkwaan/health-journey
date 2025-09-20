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
    id: 'diagnosis',
    name: 'Diagnosis & Treatment Form',
    description: 'Document patient diagnosis and treatment plan',
    fields: [
      { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'mrn', label: 'Medical Record Number', type: 'text', required: true },
      { name: 'dateOfVisit', label: 'Date of Visit', type: 'date', required: true },
      { name: 'provider', label: 'Provider', type: 'text', required: true },
      { name: 'diagnoses', label: 'Diagnoses', type: 'array', required: true },
      { name: 'treatments', label: 'Treatments/Services', type: 'array', required: true },
      { name: 'followUp', label: 'Follow-Up Plan', type: 'text', required: false },
      { name: 'signature', label: 'Provider Signature', type: 'signature', required: true }
    ]
  },
  {
    id: 'prescription',
    name: 'Prescription Form',
    description: 'Generate prescription for medications',
    fields: [
      { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
      { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'address', label: 'Address', type: 'textarea', required: true },
      { name: 'drugName', label: 'Drug Name', type: 'text', required: true },
      { name: 'strength', label: 'Strength', type: 'text', required: true },
      { name: 'form', label: 'Form', type: 'radio', required: true },
      { name: 'directions', label: 'Directions (Sig)', type: 'text', required: true },
      { name: 'quantity', label: 'Quantity', type: 'text', required: true },
      { name: 'refills', label: 'Refills', type: 'text', required: true },
      { name: 'instructions', label: 'Special Instructions', type: 'textarea', required: false }
    ]
  },
  {
    id: 'treatment_plan',
    name: 'Treatment Plan',
    description: 'Comprehensive treatment plan and recommendations',
    fields: [
      { name: 'patientName', label: 'Patient Name', type: 'text', required: true },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'diagnosis', label: 'Primary Diagnosis', type: 'text', required: true },
      { name: 'treatmentGoals', label: 'Treatment Goals', type: 'textarea', required: true },
      { name: 'medications', label: 'Medications', type: 'textarea', required: false },
      { name: 'lifestyle', label: 'Lifestyle Recommendations', type: 'textarea', required: false },
      { name: 'followUp', label: 'Follow-Up Schedule', type: 'text', required: true },
      { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false }
    ]
  }
];

export default function FormsPage() {
  const searchParams = useSearchParams();
  const params = useParams();
  const reservationId = params.id as string;
  const transcript = searchParams.get('transcript') || '';

  const [selectedForms, setSelectedForms] = useState<string[]>([]);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedForms, setGeneratedForms] = useState<Record<string, any>>({});

  // Generate form data using LLM
  const generateFormData = async (formType: string) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/forms/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType,
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

  // Handle form selection
  const handleFormSelection = (formId: string, checked: boolean) => {
    if (checked) {
      setSelectedForms(prev => [...prev, formId]);
      if (!generatedForms[formId]) {
        generateFormData(formId);
      }
    } else {
      setSelectedForms(prev => prev.filter(id => id !== formId));
    }
  };

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  };

  // Save forms
  const saveForms = async () => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forms: selectedForms.map(formId => ({
            formType: formId,
            formData: generatedForms[formId] || {}
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Forms</h2>
              <div className="space-y-4">
                {FORM_TEMPLATES.map((form) => (
                  <div key={form.id} className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id={form.id}
                      checked={selectedForms.includes(form.id)}
                      onChange={(e) => handleFormSelection(form.id, e.target.checked)}
                      className="mt-1 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <label htmlFor={form.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                        {form.name}
                      </label>
                      <p className="text-xs text-gray-500 mt-1">{form.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setSelectedForm(selectedForms[0] || null)}
                  disabled={selectedForms.length === 0}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Edit Selected Form
                </button>
                
                <button
                  onClick={saveForms}
                  disabled={selectedForms.length === 0}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Save Forms ({selectedForms.length})
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
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                        
                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={formData[field.name] || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          />
                        )}
                        
                        {field.type === 'textarea' && (
                          <textarea
                            value={formData[field.name] || ''}
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
                                  checked={formData[field.name] === option}
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
                  <p className="text-gray-500">Choose forms from the left sidebar to generate and edit them.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
