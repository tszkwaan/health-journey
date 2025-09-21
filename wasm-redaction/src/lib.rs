use wasm_bindgen::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};

// Import the `console.log` function from the `console` module
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to make console.log easier to use
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct PHIPattern {
    name: String,
    pattern: String,
    replacement: String,
    priority: u8,
}

#[derive(Serialize, Deserialize)]
pub struct RedactionResult {
    redacted_text: String,
    processing_time_ms: f64,
    patterns_applied: u32,
}

#[wasm_bindgen]
pub struct FastPHIRedactor {
    patterns: Vec<PHIPattern>,
    compiled_patterns: Vec<Regex>,
}

#[wasm_bindgen]
impl FastPHIRedactor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FastPHIRedactor {
        console_log!("Initializing WASM PHI Redactor");
        
        let patterns = vec![
            PHIPattern {
                name: "SSN".to_string(),
                pattern: r"\b\d{3}-?\d{2}-?\d{4}\b".to_string(),
                replacement: "[REDACTED_SSN]".to_string(),
                priority: 10,
            },
            PHIPattern {
                name: "Phone Numbers".to_string(),
                pattern: r"(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})".to_string(),
                replacement: "[REDACTED_PHONE]".to_string(),
                priority: 9,
            },
            PHIPattern {
                name: "Email Addresses".to_string(),
                pattern: r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b".to_string(),
                replacement: "[REDACTED_EMAIL]".to_string(),
                priority: 8,
            },
            PHIPattern {
                name: "Full Name".to_string(),
                pattern: r"\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b".to_string(),
                replacement: "[REDACTED_NAME]".to_string(),
                priority: 7,
            },
            PHIPattern {
                name: "Date Patterns".to_string(),
                pattern: r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b".to_string(),
                replacement: "[REDACTED_DATE]".to_string(),
                priority: 6,
            },
            PHIPattern {
                name: "Medical Record Numbers".to_string(),
                pattern: r"\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b".to_string(),
                replacement: "[REDACTED_MRN]".to_string(),
                priority: 5,
            },
        ];

        // Sort by priority (highest first)
        let mut sorted_patterns = patterns;
        sorted_patterns.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Compile regex patterns
        let compiled_patterns: Result<Vec<Regex>, _> = sorted_patterns
            .iter()
            .map(|p| Regex::new(&p.pattern))
            .collect();

        let compiled_patterns = match compiled_patterns {
            Ok(patterns) => patterns,
            Err(e) => {
                console_log!("Error compiling regex patterns: {:?}", e);
                return FastPHIRedactor {
                    patterns: vec![],
                    compiled_patterns: vec![],
                };
            }
        };

        FastPHIRedactor {
            patterns: sorted_patterns,
            compiled_patterns,
        }
    }

    #[wasm_bindgen]
    pub fn redact(&self, text: &str) -> String {
        let start = js_sys::Date::now();
        
        if text.is_empty() {
            return text.to_string();
        }

        // Fast PHI detection
        if !self.likely_contains_phi(text) {
            return text.to_string();
        }

        let mut redacted = text.to_string();
        let mut patterns_applied = 0;

        for (i, pattern) in self.compiled_patterns.iter().enumerate() {
            let original = redacted.clone();
            redacted = pattern.replace_all(&redacted, &self.patterns[i].replacement).to_string();
            
            if redacted != original {
                patterns_applied += 1;
            }
        }

        let end = js_sys::Date::now();
        let processing_time = end - start;
        
        console_log!("WASM Redaction completed in {:.2}ms, patterns applied: {}", 
                    processing_time, patterns_applied);

        redacted
    }

    #[wasm_bindgen]
    pub fn redact_with_stats(&self, text: &str) -> JsValue {
        let start = js_sys::Date::now();
        
        if text.is_empty() {
            let result = RedactionResult {
                redacted_text: text.to_string(),
                processing_time_ms: 0.0,
                patterns_applied: 0,
            };
            return JsValue::from_serde(&result).unwrap();
        }

        // Fast PHI detection
        if !self.likely_contains_phi(text) {
            let result = RedactionResult {
                redacted_text: text.to_string(),
                processing_time_ms: 0.0,
                patterns_applied: 0,
            };
            return JsValue::from_serde(&result).unwrap();
        }

        let mut redacted = text.to_string();
        let mut patterns_applied = 0;

        for (i, pattern) in self.compiled_patterns.iter().enumerate() {
            let original = redacted.clone();
            redacted = pattern.replace_all(&redacted, &self.patterns[i].replacement).to_string();
            
            if redacted != original {
                patterns_applied += 1;
            }
        }

        let end = js_sys::Date::now();
        let processing_time = end - start;

        let result = RedactionResult {
            redacted_text: redacted,
            processing_time_ms: processing_time,
            patterns_applied,
        };

        JsValue::from_serde(&result).unwrap()
    }

    #[wasm_bindgen]
    pub fn batch_redact(&self, texts: &JsValue) -> JsValue {
        let texts: Vec<String> = texts.into_serde().unwrap_or_default();
        let start = js_sys::Date::now();
        
        let results: Vec<String> = texts.iter()
            .map(|text| self.redact(text))
            .collect();
        
        let end = js_sys::Date::now();
        let total_time = end - start;
        
        console_log!("WASM Batch redaction completed {} items in {:.2}ms", 
                    texts.len(), total_time);

        JsValue::from_serde(&results).unwrap()
    }

    fn likely_contains_phi(&self, text: &str) -> bool {
        if text.len() < 10 {
            return false;
        }
        
        // Quick checks for common PHI patterns
        text.contains('@') || // Email
        text.contains("SSN") || // SSN keyword
        text.contains("DOB") || // DOB keyword
        text.contains("MRN") || // Medical record
        text.contains("(555)") || // Phone pattern
        text.matches(char::is_numeric).count() > 5 // Lots of numbers
    }

    #[wasm_bindgen]
    pub fn get_pattern_count(&self) -> usize {
        self.patterns.len()
    }

    #[wasm_bindgen]
    pub fn get_pattern_names(&self) -> JsValue {
        let names: Vec<String> = self.patterns.iter().map(|p| p.name.clone()).collect();
        JsValue::from_serde(&names).unwrap()
    }
}

// Export a function to create a new redactor
#[wasm_bindgen]
pub fn create_redactor() -> FastPHIRedactor {
    FastPHIRedactor::new()
}

// Export a simple redact function for direct use
#[wasm_bindgen]
pub fn redact_text(text: &str) -> String {
    let redactor = FastPHIRedactor::new();
    redactor.redact(text)
}
