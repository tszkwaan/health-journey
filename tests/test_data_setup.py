#!/usr/bin/env python3
"""
Test Data Setup: Create mock reservations and intake data for testing
"""

import requests
import json
import uuid
from datetime import datetime, timedelta

class TestDataSetup:
    """Creates and manages test data for healthcare platform testing"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
            'x-internal-call': 'true'
        })
        self.created_reservations = []
        self.created_patients = []
        self.created_doctors = []
    
    def create_test_doctor(self):
        """Create a test doctor"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        doctor_data = {
            "name": f"Dr. Test Doctor {unique_id}",
            "email": f"test.doctor.{unique_id}@example.com",
            "phone": "555-0123",
            "specialization": "Family Medicine",
            "role": "DOCTOR"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/api/test/create-doctor", 
                json=doctor_data, timeout=30)
            if response.status_code == 200:
                doctor = response.json()
                doctor_data = {
                    'id': doctor['doctorProfile']['id'],  # Use doctor profile ID
                    'userId': doctor['id'],  # Keep user ID for cleanup
                    'name': doctor['name'],
                    'email': doctor['email']
                }
                self.created_doctors.append(doctor_data)
                print(f"✅ Created test doctor: {doctor['id']}")
                return doctor_data
            else:
                print(f"❌ Failed to create doctor: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error creating doctor: {e}")
            return None
    
    def create_test_patient(self):
        """Create a test patient"""
        import uuid
        unique_id = str(uuid.uuid4())[:8]
        patient_data = {
            "name": f"Test Patient {unique_id}",
            "email": f"test.patient.{unique_id}@example.com",
            "phone": "555-0456",
            "role": "PATIENT"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/api/test/create-patient", 
                json=patient_data, timeout=30)
            if response.status_code == 200:
                patient = response.json()
                self.created_patients.append(patient['id'])
                print(f"✅ Created test patient: {patient['id']}")
                return patient
            else:
                print(f"❌ Failed to create patient: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error creating patient: {e}")
            return None
    
    def create_test_reservation(self, patient_id: str, doctor_id: str):
        """Create a test reservation"""
        # First create a time slot for the doctor
        time_slot_data = {
            "doctorId": doctor_id,
            "date": (datetime.now() + timedelta(days=1)).isoformat(),
            "startTime": "09:00",
            "endTime": "10:00",
            "isAvailable": True
        }
        
        try:
            # Create time slot using the doctor profile ID
            ts_response = self.session.post(f"{self.base_url}/api/test/create-time-slot", 
                json=time_slot_data, timeout=30)
            if ts_response.status_code != 200:
                print(f"❌ Failed to create time slot: {ts_response.status_code}")
                print(f"Error: {ts_response.text}")
                return None
            
            time_slot = ts_response.json()
            
            # Now create reservation with time slot
            reservation_data = {
                "patientId": patient_id,
                "doctorId": doctor_id,  # This should be the doctor profile ID
                "timeSlotId": time_slot['id'],
                "status": "PENDING_INTAKE",
                "reason": "Test consultation for grounding validation"
            }
            
            response = self.session.post(f"{self.base_url}/api/test/create-reservation", 
                json=reservation_data, timeout=30)
            if response.status_code == 200:
                reservation = response.json()
                self.created_reservations.append(reservation['id'])
                print(f"✅ Created test reservation: {reservation['id']}")
                return reservation
            else:
                print(f"❌ Failed to create reservation: {response.status_code}")
                print(f"Error: {response.text}")
                return None
        except Exception as e:
            print(f"❌ Error creating reservation: {e}")
            return None
    
    def create_test_intake_data(self, reservation_id: str, patient_id: str):
        """Create test intake data"""
        intake_data = {
            "reservationId": reservation_id,
            "patientId": patient_id,
            "answers": {
                "visit_reason": "headache and fever",
                "symptom_onset": "this morning",
                "previous_treatment": "none",
                "medical_conditions": "none",
                "allergies": "none",
                "concerns": "none"
            },
            "status": "COMPLETED"
        }
        
        try:
            response = self.session.post(f"{self.base_url}/api/test/create-intake", 
                json=intake_data, timeout=30)
            if response.status_code == 200:
                intake = response.json()
                print(f"✅ Created test intake: {intake['id']}")
                return intake
            else:
                print(f"❌ Failed to create intake: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error creating intake: {e}")
            return None
    
    def create_test_medical_background(self, patient_id: str):
        """Create test medical background"""
        medical_data = {
            "patientId": patient_id,
            "medicalHistory": "No significant medical history",
            "medications": "None",
            "allergies": "None known",
            "isCurrent": True
        }
        
        try:
            response = self.session.post(f"{self.base_url}/api/test/create-medical-background", 
                json=medical_data, timeout=30)
            if response.status_code == 200:
                medical = response.json()
                print(f"✅ Created test medical background: {medical['id']}")
                return medical
            else:
                print(f"❌ Failed to create medical background: {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ Error creating medical background: {e}")
            return None
    
    def setup_complete_test_data(self):
        """Create complete test data set"""
        print("🔧 Setting up complete test data...")
        
        # Create doctor
        doctor = self.create_test_doctor()
        if not doctor:
            return None
        
        # Create patient
        patient = self.create_test_patient()
        if not patient:
            return None
        
        # Create reservation
        reservation = self.create_test_reservation(patient['id'], doctor['id'])
        if not reservation:
            return None
        
        # Create intake data
        intake = self.create_test_intake_data(reservation['id'], patient['id'])
        if not intake:
            return None
        
        # Create medical background
        medical = self.create_test_medical_background(patient['id'])
        if not medical:
            return None
        
        return {
            'doctor': doctor,
            'patient': patient,
            'reservation': reservation,
            'intake': intake,
            'medical': medical
        }
    
    def cleanup_test_data(self):
        """Clean up all created test data"""
        print("🧹 Cleaning up test data...")
        
        # Clean up reservations
        for reservation_id in self.created_reservations:
            try:
                self.session.delete(f"{self.base_url}/api/test/reservations/{reservation_id}", timeout=30)
                print(f"✅ Cleaned up reservation: {reservation_id}")
            except Exception as e:
                print(f"⚠️ Error cleaning up reservation {reservation_id}: {e}")
        
        # Clean up patients
        for patient_id in self.created_patients:
            try:
                self.session.delete(f"{self.base_url}/api/test/patients/{patient_id}", timeout=30)
                print(f"✅ Cleaned up patient: {patient_id}")
            except Exception as e:
                print(f"⚠️ Error cleaning up patient {patient_id}: {e}")
        
        # Clean up doctors (use userId for deletion)
        for doctor_data in self.created_doctors:
            try:
                if isinstance(doctor_data, dict) and 'userId' in doctor_data:
                    doctor_id = doctor_data['userId']
                else:
                    doctor_id = doctor_data
                self.session.delete(f"{self.base_url}/api/test/doctors/{doctor_id}", timeout=30)
                print(f"✅ Cleaned up doctor: {doctor_id}")
            except Exception as e:
                print(f"⚠️ Error cleaning up doctor {doctor_id}: {e}")
        
        print("✅ Test data cleanup completed")

def main():
    """Test the data setup"""
    setup = TestDataSetup()
    
    # Create test data
    test_data = setup.setup_complete_test_data()
    if test_data:
        print("✅ Test data created successfully")
        print(f"Reservation ID: {test_data['reservation']['id']}")
        print(f"Patient ID: {test_data['patient']['id']}")
        print(f"Doctor ID: {test_data['doctor']['id']}")
        
        # Clean up
        setup.cleanup_test_data()
    else:
        print("❌ Failed to create test data")

if __name__ == "__main__":
    main()
