"use client";
import { useState, useEffect } from 'react';

interface Form {
  id: string;
  formType: string;
  formData: any;
  isGenerated: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentsTabProps {
  reservationId: string;
}

export default function DocumentsTab({ reservationId }: DocumentsTabProps) {
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);

  useEffect(() => {
    fetchForms();
  }, [reservationId]);

  const fetchForms = async () => {
    try {
      const response = await fetch(`/api/reservations/${reservationId}/forms`);
      if (response.ok) {
        const data = await response.json();
        setForms(data.forms || []);
      } else {
        console.error('Failed to fetch forms');
      }
    } catch (error) {
      console.error('Error fetching forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFormTypeDisplayName = (formType: string): string => {
    const typeMap: Record<string, string> = {
      'diagnosis': 'Diagnosis & Treatment Form',
      'prescription': 'Prescription Form',
      'treatment_plan': 'Treatment Plan'
    };
    return typeMap[formType] || formType;
  };

  const formatFormData = (formData: any): string => {
    if (!formData) return 'No data available';
    
    const entries = Object.entries(formData)
      .filter(([key, value]) => value && value !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    return entries || 'No data available';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Documents</h3>
        <span className="text-sm text-gray-500">{forms.length} document(s)</span>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
          <p className="text-gray-600">Generated forms from consultation sessions will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Forms List */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Saved Forms</h4>
            <div className="space-y-3">
              {forms.map((form) => (
                <div
                  key={form.id}
                  onClick={() => setSelectedForm(form)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedForm?.id === form.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {getFormTypeDisplayName(form.formType)}
                      </h5>
                      <p className="text-sm text-gray-500">
                        Created: {new Date(form.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {form.isGenerated && (
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          AI Generated
                        </span>
                      )}
                      {form.isCompleted && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Preview */}
          <div className="space-y-4">
            <h4 className="text-md font-medium text-gray-900">Form Preview</h4>
            {selectedForm ? (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-4">
                  <h5 className="text-lg font-semibold text-gray-900 mb-2">
                    {getFormTypeDisplayName(selectedForm.formType)}
                  </h5>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Created: {new Date(selectedForm.createdAt).toLocaleDateString()}</span>
                    <span>Updated: {new Date(selectedForm.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h6 className="font-medium text-gray-900 mb-2">Form Data:</h6>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {formatFormData(selectedForm.formData)}
                    </pre>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const dataStr = JSON.stringify(selectedForm.formData, null, 2);
                        const dataBlob = new Blob([dataStr], { type: 'application/json' });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `${selectedForm.formType}_${selectedForm.id}.json`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Download JSON
                    </button>
                    
                    <button
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head><title>${getFormTypeDisplayName(selectedForm.formType)}</title></head>
                              <body>
                                <h1>${getFormTypeDisplayName(selectedForm.formType)}</h1>
                                <pre>${formatFormData(selectedForm.formData)}</pre>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-500">Select a form to preview its contents</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
