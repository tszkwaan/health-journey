"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define types for the medical background data
interface SurgicalHistoryItem {
  year: string;
  type: string;
  reason: string;
  dateRange: string;
}

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
}

interface AllergyItem {
  type: string;
  reaction: string;
  other: string;
}

interface SmokingInfo {
  smokes: boolean;
  packsPerDay?: string;
  yearsSmoked?: string;
}

interface AlcoholInfo {
  drinks: boolean;
  type?: string;
  frequency?: string;
  amount?: string;
}

interface PregnancyHistoryItem {
  year: string;
  type: string;
}

interface ImmunizationItem {
  type: string;
  date?: string;
  other?: string;
}

interface MedicalBackgroundData {
  pastMedicalConditions?: string[];
  otherMedicalCondition?: string;
  surgicalHistory?: SurgicalHistoryItem[];
  medications?: MedicationItem[];
  allergies?: AllergyItem[];
  otherAllergy?: string;
  familyHistory?: string[];
  otherFamilyHistory?: string;
  smoking?: SmokingInfo;
  alcohol?: AlcoholInfo;
  exerciseFrequency?: string;
  occupation?: string;
  menstrualCycle?: string;
  menopause?: string;
  pregnancyHistory?: PregnancyHistoryItem[];
  contraceptives?: string[];
  immunizations?: ImmunizationItem[];
  otherImmunization?: string;
}

const MEDICAL_CONDITIONS = [
  'Asthma', 'Diabetes', 'High Blood Pressure', 'Heart Disease', 'Stroke',
  'Cancer', 'Kidney Disease', 'Liver Disease', 'Thyroid Disorder', 'Autoimmune Disease'
];

const FAMILY_HISTORY_CONDITIONS = [
  'Heart Disease', 'Diabetes', 'Cancer', 'Stroke', 'High Blood Pressure',
  'Asthma', 'Allergies', 'Mental Health Issues'
];

const CONTRACEPTIVE_OPTIONS = [
  'Pills', 'IUD', 'Implant', 'Injection', 'Patch', 'Ring', 'Condoms', 'Diaphragm', 'Spermicide', 'Sterilization'
];

const IMMUNIZATION_TYPES = [
  'Flu', 'Tetanus', 'HPV', 'MMR', 'Varicella', 'Hepatitis A', 'Hepatitis B'
];

export default function MedicalBackgroundPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<MedicalBackgroundData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchMedicalBackground();
    }
  }, [status, router]);

  const fetchMedicalBackground = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/medical-background');
      if (response.ok) {
        const medicalBackground = await response.json();
        // If medicalBackground is null (no data exists), that's fine - start with empty form
        if (medicalBackground) {
          setData(medicalBackground);
        } else {
          // No medical background exists yet, start with empty form
          setData({});
        }
      } else {
        console.error('Failed to fetch medical background:', response.statusText);
        // Even if fetch fails, allow user to fill out form
        setData({});
      }
    } catch (error) {
      console.error('Error fetching medical background:', error);
      // Even if there's an error, allow user to fill out form
      setData({});
    } finally {
      setLoading(false);
    }
  };

  const updateData = (field: keyof MedicalBackgroundData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const addArrayItem = (field: keyof MedicalBackgroundData, item: any) => {
    setData(prev => ({
      ...prev,
      [field]: [...((prev[field] as any[]) || []), item]
    }));
    setSaved(false);
  };

  const updateArrayItem = (field: keyof MedicalBackgroundData, index: number, newItem: any) => {
    setData(prev => ({
      ...prev,
      [field]: ((prev[field] as any[]) || []).map((item, i) => (i === index ? newItem : item))
    }));
    setSaved(false);
  };

  const removeArrayItem = (field: keyof MedicalBackgroundData, index: number) => {
    setData(prev => ({
      ...prev,
      [field]: ((prev[field] as any[]) || []).filter((_, i) => i !== index)
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch('/api/medical-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSaved(true);
        // Re-fetch to get the latest version and ensure UI is in sync
        await fetchMedicalBackground(); 
      } else {
        console.error('Failed to save medical background:', response.statusText);
        alert('Failed to save medical background. Please try again.');
      }
    } catch (error) {
      console.error('Error saving medical background:', error);
      alert('Error saving medical background. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
        fontFamily: 'var(--font-noto-sans)'
      }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
            Loading medical background...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || (session?.user as any)?.role !== 'PATIENT') {
    return null;
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(135deg, #E6DFFF 0%, #DDE9FF 50%, #F9FBFF 100%)',
      fontFamily: 'var(--font-noto-sans)'
    }}>
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">🛡️</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                HealthFirst
              </h1>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                {session?.user?.name || 'Patient'}
              </span>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-600 font-semibold text-sm">
                  {(session?.user?.name || 'P').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Medical Background Form - Single Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
              Medical History
            </h1>
            <p className="text-gray-600" style={{ fontFamily: 'var(--font-noto-sans)' }}>
              Please fill out the following information to the best of your background.
            </p>
          </div>

          {/* Form Sections */}
          <div className="space-y-8">
            {/* Past Medical Conditions */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Past Medical Conditions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MEDICAL_CONDITIONS.map((condition) => (
                  <label key={condition} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.pastMedicalConditions?.includes(condition) || false}
                      onChange={(e) => {
                        const conditions = data.pastMedicalConditions || [];
                        if (e.target.checked) {
                          updateData('pastMedicalConditions', [...conditions, condition]);
                        } else {
                          updateData('pastMedicalConditions', conditions.filter(c => c !== condition));
                        }
                      }}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                      {condition}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Specify other condition"
                  value={data.otherMedicalCondition || ''}
                  onChange={(e) => updateData('otherMedicalCondition', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                />
              </div>
            </div>

            {/* Surgical & Hospitalization History */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Surgical & Hospitalization History
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Year
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Detail (Type & Reason)
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.surgicalHistory || []).map((surgery, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={surgery.year}
                            onChange={(e) => updateArrayItem('surgicalHistory', index, { ...surgery, year: e.target.value })}
                            placeholder="Year"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={`${surgery.type} - ${surgery.reason}`}
                            onChange={(e) => {
                              const [type, reason] = e.target.value.split(' - ');
                              updateArrayItem('surgicalHistory', index, { ...surgery, type: type || '', reason: reason || '' });
                            }}
                            placeholder="Type - Reason"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => removeArrayItem('surgicalHistory', index)}
                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => addArrayItem('surgicalHistory', { year: '', type: '', reason: '', dateRange: '' })}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Add Surgery/Hospitalization
              </button>
            </div>

            {/* Medications */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Medications
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Dosage
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Frequency
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.medications || []).map((medication, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={medication.name}
                            onChange={(e) => updateArrayItem('medications', index, { ...medication, name: e.target.value })}
                            placeholder="Medication name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={medication.dosage}
                            onChange={(e) => updateArrayItem('medications', index, { ...medication, dosage: e.target.value })}
                            placeholder="Dosage"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={medication.frequency}
                            onChange={(e) => updateArrayItem('medications', index, { ...medication, frequency: e.target.value })}
                            placeholder="Frequency"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => removeArrayItem('medications', index)}
                            className="text-red-600 hover:text-red-800 font-bold text-lg"
                            style={{ fontFamily: 'var(--font-noto-sans)' }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => addArrayItem('medications', { name: '', dosage: '', frequency: '' })}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
                style={{ fontFamily: 'var(--font-noto-sans)' }}
              >
                Add Medication
              </button>
            </div>

            {/* Allergies */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Allergies
              </h2>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  Please list any allergies you have (food, drug, environmental, insect, etc.)
                </p>
                <textarea
                  placeholder="e.g., Penicillin (rash), Shellfish (nausea), Pollen (sneezing), Latex (skin irritation)"
                  value={data.otherAllergy || ''}
                  onChange={(e) => updateData('otherAllergy', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                />
              </div>
            </div>

            {/* Family History */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Family History
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {FAMILY_HISTORY_CONDITIONS.map((condition) => (
                  <label key={condition} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.familyHistory?.includes(condition) || false}
                      onChange={(e) => {
                        const history = data.familyHistory || [];
                        if (e.target.checked) {
                          updateData('familyHistory', [...history, condition]);
                        } else {
                          updateData('familyHistory', history.filter(c => c !== condition));
                        }
                      }}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                      {condition}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Specify other family history"
                  value={data.otherFamilyHistory || ''}
                  onChange={(e) => updateData('otherFamilyHistory', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                />
              </div>
            </div>

            {/* Lifestyle */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Lifestyle
              </h2>
              
              {/* Smoking */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-gray-700 font-medium" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Do you smoke?
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.smoking?.smokes || false}
                      onChange={(e) => updateData('smoking', { 
                        ...data.smoking, 
                        smokes: e.target.checked 
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                {data.smoking?.smokes && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="Packs per day"
                      value={data.smoking.packsPerDay || ''}
                      onChange={(e) => updateData('smoking', { 
                        ...data.smoking, 
                        packsPerDay: e.target.value 
                      })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    />
                    <input
                      type="text"
                      placeholder="Years smoked"
                      value={data.smoking.yearsSmoked || ''}
                      onChange={(e) => updateData('smoking', { 
                        ...data.smoking, 
                        yearsSmoked: e.target.value 
                      })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    />
                  </div>
                )}
              </div>

              {/* Alcohol */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-gray-700 font-medium" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Do you drink alcohol?
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.alcohol?.drinks || false}
                      onChange={(e) => updateData('alcohol', { 
                        ...data.alcohol, 
                        drinks: e.target.checked 
                      })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                {data.alcohol?.drinks && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <select
                      value={data.alcohol.type || ''}
                      onChange={(e) => updateData('alcohol', { 
                        ...data.alcohol, 
                        type: e.target.value 
                      })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      <option value="">Type</option>
                      <option value="beer">Beer</option>
                      <option value="wine">Wine</option>
                      <option value="spirits">Spirits</option>
                      <option value="mixed">Mixed drinks</option>
                    </select>
                    <select
                      value={data.alcohol.frequency || ''}
                      onChange={(e) => updateData('alcohol', { 
                        ...data.alcohol, 
                        frequency: e.target.value 
                      })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      <option value="">Frequency</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="occasionally">Occasionally</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Amount"
                      value={data.alcohol.amount || ''}
                      onChange={(e) => updateData('alcohol', { 
                        ...data.alcohol, 
                        amount: e.target.value 
                      })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    />
                  </div>
                )}
              </div>

              {/* Exercise and Occupation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Exercise Frequency
                  </label>
                  <select
                    value={data.exerciseFrequency || ''}
                    onChange={(e) => updateData('exerciseFrequency', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    <option value="">Select frequency</option>
                    <option value="daily">Daily</option>
                    <option value="3-4x-week">3-4 times per week</option>
                    <option value="1-2x-week">1-2 times per week</option>
                    <option value="occasionally">Occasionally</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Occupation
                  </label>
                  <input
                    type="text"
                    placeholder="Your occupation"
                    value={data.occupation || ''}
                    onChange={(e) => updateData('occupation', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  />
                </div>
              </div>
            </div>

            {/* Reproductive & Women's Health */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Reproductive & Women's Health
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Menstrual Cycle
                  </label>
                  <select
                    value={data.menstrualCycle || ''}
                    onChange={(e) => updateData('menstrualCycle', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    <option value="">Select status</option>
                    <option value="regular">Regular</option>
                    <option value="irregular">Irregular</option>
                    <option value="not-applicable">Not applicable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                    Menopause
                  </label>
                  <select
                    value={data.menopause || ''}
                    onChange={(e) => updateData('menopause', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    style={{ fontFamily: 'var(--font-noto-sans)' }}
                  >
                    <option value="">Select status</option>
                    <option value="pre-menopause">Pre-menopause</option>
                    <option value="peri-menopause">Peri-menopause</option>
                    <option value="post-menopause">Post-menopause</option>
                    <option value="not-applicable">Not applicable</option>
                  </select>
                </div>
              </div>

              {/* Pregnancy History */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  Pregnancy History
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          Year
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          Type
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.pregnancyHistory || []).map((pregnancy, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={pregnancy.year}
                              onChange={(e) => updateArrayItem('pregnancyHistory', index, { ...pregnancy, year: e.target.value })}
                              placeholder="Year"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              style={{ fontFamily: 'var(--font-noto-sans)' }}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={pregnancy.type}
                              onChange={(e) => updateArrayItem('pregnancyHistory', index, { ...pregnancy, type: e.target.value })}
                              placeholder="Type (e.g., Vaginal, C-Section)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              style={{ fontFamily: 'var(--font-noto-sans)' }}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => removeArrayItem('pregnancyHistory', index)}
                              className="text-red-600 hover:text-red-800 font-bold text-lg"
                              style={{ fontFamily: 'var(--font-noto-sans)' }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => addArrayItem('pregnancyHistory', { year: '', type: '' })}
                  className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 cursor-pointer"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  Add Pregnancy
                </button>
              </div>

              {/* Contraceptives */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                  Contraceptives Used
                </h3>
                <div className="flex flex-wrap gap-2">
                  {CONTRACEPTIVE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        const contraceptives = data.contraceptives || [];
                        if (contraceptives.includes(option)) {
                          updateData('contraceptives', contraceptives.filter(c => c !== option));
                        } else {
                          updateData('contraceptives', [...contraceptives, option]);
                        }
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                        data.contraceptives?.includes(option)
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                      style={{ fontFamily: 'var(--font-noto-sans)' }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Immunizations */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                Immunizations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {IMMUNIZATION_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={data.immunizations?.some(i => i.type === type) || false}
                      onChange={(e) => {
                        const immunizations = data.immunizations || [];
                        if (e.target.checked) {
                          updateData('immunizations', [...immunizations, { type, date: '', other: '' }]);
                        } else {
                          updateData('immunizations', immunizations.filter(i => i.type !== type));
                        }
                      }}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-gray-700" style={{ fontFamily: 'var(--font-noto-sans)' }}>
                      {type}
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Specify other immunization"
                  value={data.otherImmunization || ''}
                  onChange={(e) => updateData('otherImmunization', e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                />
                <input
                  type="date"
                  placeholder="Date"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-8 border-t border-gray-200">
              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    saving
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                  }`}
                  style={{ fontFamily: 'var(--font-noto-sans)' }}
                >
                  {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}