package resume_parser // Or whatever you name your Go Cloud Function package

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"github.com/writeas/go-strip-markdown"
	"github.com/nguyenthenguyen/docx"
)

// Response structure for the Cloud Function
type ParseResponse struct {
	ExtractedText string `json:"extractedText,omitempty"`
	Error         string `json:"error,omitempty"`
}

// HTTP Cloud Function entry point
func ParseResume(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	// Enable CORS if your client is on a different domain
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	// Max 10MB file
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		log.Printf("Error parsing multipart form: %v", err)
		json.NewEncoder(w).Encode(ParseResponse{Error: "Error parsing request: " + err.Error()})
		return
	}

	file, handler, err := r.FormFile("resumeFile") // "resumeFile" is the name of the form field for the file
	if err != nil {
		log.Printf("Error retrieving the file: %v", err)
		json.NewEncoder(w).Encode(ParseResponse{Error: "Error retrieving resume file: " + err.Error()})
		return
	}
	defer file.Close()

	// Get fileType from form value (e.g., 'md', 'docx')
	// Alternatively, try to infer from handler.Filename extension
	fileType := r.FormValue("fileType")
	if fileType == "" {
		fileName := handler.Filename
		if strings.HasSuffix(strings.ToLower(fileName), ".docx") {
			fileType = "docx"
		} else if strings.HasSuffix(strings.ToLower(fileName), ".md") {
			fileType = "md"
		} else {
			log.Printf("Missing 'fileType' and could not infer from filename: %s", fileName)
			json.NewEncoder(w).Encode(ParseResponse{Error: "Missing 'fileType' (e.g., 'md', 'docx') or unsupported extension."})
			return
		}
	}

	fileBytes, err := ioutil.ReadAll(file)
	if err != nil {
		log.Printf("Error reading file content: %v", err)
		json.NewEncoder(w).Encode(ParseResponse{Error: "Error reading file content: " + err.Error()})
		return
	}

	var extractedText string
	var extractionErr error

	switch strings.ToLower(fileType) {
	case "docx":
		// Write bytes to a temporary file since the library doesn't support reading from bytes
		tmpFile, err := ioutil.TempFile("", "resume-*.docx")
		if err != nil {
			extractionErr = fmt.Errorf("error creating temp file: %w", err)
			break
		}
		defer tmpFile.Close()
		defer os.Remove(tmpFile.Name()) // Clean up temp file
		
		if _, err := tmpFile.Write(fileBytes); err != nil {
			extractionErr = fmt.Errorf("error writing to temp file: %w", err)
			break
		}
		
		docReader, err := docx.ReadDocxFile(tmpFile.Name())
		if err != nil {
			extractionErr = fmt.Errorf("error reading docx file: %w", err)
			break
		}
		extractedText = docReader.Editable().GetContent()
		docReader.Close() // Important to close the reader
	case "md":
		// Using go-strip-markdown to remove markdown syntax
		extractedText = stripmd.Strip(string(fileBytes))
		// // Or, for a simpler approach (if AI handles MD well or MD is minimal):
		// extractedText = string(fileBytes)
	default:
		extractionErr = fmt.Errorf("unsupported file type: %s. Only 'md' and 'docx' are supported", fileType)
	}

	if extractionErr != nil {
		log.Printf("Error extracting text: %v", extractionErr)
		json.NewEncoder(w).Encode(ParseResponse{Error: extractionErr.Error()})
		return
	}

	log.Printf("Successfully extracted text for file type: %s, length: %d", fileType, len(extractedText))
	json.NewEncoder(w).Encode(ParseResponse{ExtractedText: extractedText})
}
