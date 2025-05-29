import os
import json
import logging
import re
from datetime import datetime
import sys

# --- Library Imports with Checks ---
genai_available = False
google_api_available = False
requests_available = False

try:

    from dotenv import load_dotenv
except ImportError:
    print("ERROR: 'dotenv' module not found. Run: pip install python-dotenv", file=sys.stderr)
    load_dotenv = None

try:

    import google.generativeai as genai
    genai_available = True
except ImportError:
    print("ERROR: 'google.generativeai' module not found. Run: pip install google-generativeai", file=sys.stderr)

try:

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    google_api_available = True
except ImportError:
    print("ERROR: Google API client libraries not found. Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib", file=sys.stderr)
    # Define HttpError as base Exception if libs missing
    class HttpError(Exception): pass

try:
    # Level 0 indentation
    import requests
    requests_available = True
except ImportError:
    print("ERROR: requests library not found. Run 'pip install requests'", file=sys.stderr)


# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Environment Variable Loading ---
dotenv_loaded_path = None

if load_dotenv:

    script_dir = os.path.dirname(__file__)
    parent_dir = os.path.dirname(script_dir)
    dotenv_path_parent = os.path.join(parent_dir, '.env')
    if os.path.exists(dotenv_path_parent):

        load_dotenv(dotenv_path=dotenv_path_parent, override=True)
        dotenv_loaded_path = dotenv_path_parent

    else:

        dotenv_path_current = os.path.join(script_dir, '.env')
        if os.path.exists(dotenv_path_current):

            load_dotenv(dotenv_path=dotenv_path_current, override=True)
            dotenv_loaded_path = dotenv_path_current

        else:

            dotenv_loaded_path = script_dir if os.path.isdir(script_dir) else os.getcwd()
else:

    script_dir = os.path.dirname(__file__)
    dotenv_loaded_path = script_dir if os.path.isdir(script_dir) else os.getcwd()

# --- Configuration Constants ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID')
SHEET_SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SEARCH_ENGINE_ID = os.getenv('SEARCH_ENGINE_ID')
GOOGLE_API_KEY = os.getenv('SEARCH_ENGINE_API') 

SCRIPT_DIR = os.path.dirname(__file__)
CREDENTIALS_PATH = os.path.join(SCRIPT_DIR, 'credentials.json') 
TOKEN_PATH = os.path.join(SCRIPT_DIR, 'token.json') 

# --- Default Error Response ---
DEFAULT_JSON_RESPONSE = {
    "error": "An unexpected error occurred during analysis.",
    "timestamp": datetime.now().isoformat(),
    "status": "failed",
    "details": "Please check logs for more information."
}

# --- Core Analysis Class ---
class CustomizedAnalysis:
    """Generates analysis using Gemini, Sheets (OAuth), and Search."""


    def __init__(self):
        """Initialize API clients and model."""

        logger.info("Customized Analysis module initializing...")
        self.model_name = 'gemini-2.0-flash'
        self.sheets_service = None
        self.search_service = None
        self.model = None
        self.creds = None 

        # Init Gemini
        if genai_available and GEMINI_API_KEY:
            try:
                # Ensure genai is imported if genai_available is True
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                self.model = genai.GenerativeModel(self.model_name)
                logger.info(f"Gemini model initialized: '{self.model_name}'")
            except Exception as e:
                logger.error(f"Failed Gemini init: {e}", exc_info=True)
        else:
            logger.warning(f"Gemini unavailable (Lib: {genai_available}, Key: {bool(GEMINI_API_KEY)})")

        # Init Sheets (OAuth Flow)
        if google_api_available:
            try:
                # Load existing token if possible
                if os.path.exists(TOKEN_PATH):
                    try:
                        self.creds = Credentials.from_authorized_user_file(TOKEN_PATH, SHEET_SCOPES)
                        logger.debug(f"Loaded token: {TOKEN_PATH}")
                    except Exception as token_err:
                        logger.warning(f"Token load error: {token_err}. Re-auth needed.")
                        self.creds = None 

                # Validate credentials 
                if not self.creds or not self.creds.valid:
                    if self.creds and self.creds.expired and self.creds.refresh_token:
                        logger.info("Refreshing credentials...")
                        try:
                            self.creds.refresh(Request())
                            logger.info("Creds refreshed.")
                            # Save the refreshed credentials
                            with open(TOKEN_PATH, 'w') as tf:
                                tf.write(self.creds.to_json())
                            logger.debug(f"Refreshed token saved.")
                        except Exception as ref_err:
                            logger.error(f"Cred refresh failed: {ref_err}. Re-auth needed.", exc_info=True)
                            try:
                                os.remove(TOKEN_PATH) 
                                logger.debug(f"Removed potentially invalid token file: {TOKEN_PATH}")
                            except OSError: pass
                            self.creds = None 

                    # If still no valid creds, run the auth flow
                    if not self.creds or not self.creds.valid:
                        if os.path.exists(CREDENTIALS_PATH):
                            logger.info(f"Running auth flow using {CREDENTIALS_PATH}...")
                            if InstalledAppFlow:
                                try: 
                                    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SHEET_SCOPES)
                                    self.creds = flow.run_local_server(port=0)
                                    logger.info("Auth flow complete.")
                                    # Save the new credentials
                                    with open(TOKEN_PATH, 'w') as tf:
                                        tf.write(self.creds.to_json())
                                    logger.debug(f"New token saved.")
                                except Exception as flow_err:
                                     logger.error(f"Auth flow failed: {flow_err}", exc_info=True)
                                     self.creds = None 
                            else:
                                logger.error("InstalledAppFlow not available!")
                                self.creds = None 
                        else:
                            logger.error(f"credentials.json missing: {CREDENTIALS_PATH}.")
                            self.creds = None 

                # Build Sheets service if creds are valid
                if self.creds and self.creds.valid:
                    if build:
                        self.sheets_service = build('sheets', 'v4', credentials=self.creds)
                        logger.info("Sheets client initialized.")
                    else:
                        logger.error("googleapiclient.discovery.build not available!")
                else:
                    # Check if service is None before logging - avoids logging this if init already failed earlier
                    if self.sheets_service is None:
                        logger.error("Failed to get valid Sheets creds after attempting load/refresh/flow.")

            except Exception as auth_err:
                # Catch any unexpected error during the whole auth process
                logger.error(f"General Sheets auth/build error: {auth_err}", exc_info=True)
                self.creds = None 
                self.sheets_service = None 

        else:
            logger.error("Google API libs missing. Sheets unavailable.")

        # Init Search (No changes needed for the AttributeError fix, but requires correct API key)
        if google_api_available and GOOGLE_API_KEY and SEARCH_ENGINE_ID:
            try:
                if build:
                    self.search_service = build('customsearch', 'v1', developerKey=GOOGLE_API_KEY)
                    logger.info("Search client initialized.")
                else:
                    logger.error("googleapiclient.discovery.build not available!")
            except Exception as e:
                logger.error(f"Failed Search init: {e}", exc_info=True)
        else:
            # This warning still depends on GOOGLE_API_KEY being correctly set from the env var
            logger.warning(f"Search unavailable (Libs: {google_api_available}, Key: {bool(GOOGLE_API_KEY)}, ID: {bool(SEARCH_ENGINE_ID)})")

        logger.info("Initialization attempt complete.")

    def get_spreadsheet_data(self):
            """Fetch data ONLY from the 'Data100' sheet in Google Sheets."""

            # Assume self.sheets_service, SPREADSHEET_ID, google_api_available, logger, HttpError are defined/accessible
            # within the class or globally as appropriate.

            if not self.sheets_service:
                logger.error("Sheets service unavailable.")
                return []
            if not SPREADSHEET_ID:
                logger.error("SPREADSHEET_ID missing.")
                return []
            if not google_api_available: # Assuming google_api_available is defined globally or in class scope
                logger.error("Google API Libs unavailable.")
                return []

            all_data = []
            target_sheet_name = "Data100" # Specify the exact sheet name here
            # Define the range to read from the target sheet (e.g., all columns A to Z)
            range_name = f"'{target_sheet_name}'!A:Z"
            logger.info(f"Attempting to fetch data from sheet: '{target_sheet_name}' range: {range_name}")

            try:
                # Directly get values from the specified sheet and range
                result = self.sheets_service.spreadsheets().values().get(
                    spreadsheetId=SPREADSHEET_ID,
                    range=range_name,
                    valueRenderOption='FORMATTED_VALUE',
                    dateTimeRenderOption='FORMATTED_STRING'
                ).execute()

                values = result.get('values', [])

                if not values or len(values) < 2: # Check if sheet has headers and at least one data row
                    logger.warning(f"No data or only headers found in sheet: '{target_sheet_name}'")
                    return [] # Return empty list if no data

                # Process the data from the single sheet
                headers = [str(h).strip().lower() for h in values[0]]
                logger.debug(f"Headers from '{target_sheet_name}': {headers}")

                empty_rows = 0
                added_rows = 0
                for row in values[1:]: # Start from the second row (index 1)
                    if not any(str(cell).strip() for cell in row):
                        empty_rows += 1
                        continue # Skip entirely empty rows

                    # Create dictionary for the row using headers
                    row_data = {headers[i]: str(value).strip() for i, value in enumerate(row) if i < len(headers) and headers[i]}

                    if row_data:
                        # Optionally add the source sheet name if needed elsewhere, though it's always 'Data100' now
                        row_data['source_sheet'] = target_sheet_name
                        all_data.append(row_data)
                        added_rows += 1

                logger.info(f"Sheet '{target_sheet_name}': Added {added_rows} rows, Skipped {empty_rows} empty rows.")
                logger.info(f"Fetched {len(all_data)} records total from '{target_sheet_name}'.")
                return all_data

            except HttpError as error:
                logger.error(f"HTTP error accessing sheet '{target_sheet_name}': {error}")
                # Check for specific permission errors
                if hasattr(error, 'resp') and error.resp.status == 403:
                    logger.error(f"Permission denied for sheet '{target_sheet_name}'. Check sharing settings or API scopes.")
                # Check if the sheet itself was not found (often a 400 error with specific reason)
                elif hasattr(error, 'resp') and error.resp.status == 400:
                    # Simplified check, error content might vary
                    error_content_str = str(error.content) 
                    if 'Unable to parse range' in error_content_str or 'Unable to parse range' in str(error): 
                        logger.error(f"Sheet '{target_sheet_name}' or range '{range_name}' not found or invalid.")
                    else:
                        logger.error(f"API Error (400) accessing sheet '{target_sheet_name}'. Check sheet name/range. Details: {error_content_str}")
               

                return [] 
            except Exception as e:
                logger.error(f"Unexpected error reading sheet '{target_sheet_name}': {e}", exc_info=True)
                return [] 

    def search_internet(self, query: str, num_results: int = 5):
        """Search internet using Google Custom Search."""

        if not self.search_service: logger.error("Search service unavailable."); return []
        if not google_api_available: logger.error("Google API Libs unavailable."); return []
        if not SEARCH_ENGINE_ID: logger.error("SEARCH_ENGINE_ID missing."); return []

        logger.info(f"Searching: {query}")
        try:

            result = self.search_service.cse().list(q=query, cx=SEARCH_ENGINE_ID, num=num_results).execute()
            items = result.get('items', [])
            search_results = [{'title': item.get('title','').strip(), 'snippet': item.get('snippet','').replace('\n',' ').strip(), 'link': item.get('link','')} for item in items if item.get('title') and item.get('snippet') and item.get('link')]
            logger.info(f"Fetched {len(search_results)} results.")
            return search_results
        except HttpError as error:
            logger.error(f"Search HTTP error: {error}"); return []
        except Exception as e:
            logger.error(f"Search unexpected error: {e}", exc_info=True); return []


    def _construct_gemini_prompt(self, options, filtered_data, search_results=None):
        """Constructs the prompt for Gemini based on inputs."""

        category = options.get('category', 'General'); time_period = options.get('time_period', 'Not Specified'); time_detail = options.get('time_detail', ''); time_frame = f"{time_period} ({time_detail})" if time_detail else time_period
        key_fields = ['title', 'category', 'budget', 'description', 'status', 'start date', 'end date', 'duration', 'location', 'objective', 'target audience']
        simplified_data = []; max_items = 5
        for item in filtered_data[:max_items]:

            simplified_item = {k: item[k] for k in key_fields if k in item and item[k]}
            if simplified_item:

                simplified_data.append(simplified_item)
        budgets = []; avg_budget = 0.0
        for item in filtered_data:

            budget_str = item.get('budget', '');
            if isinstance(budget_str, (int, float)): budgets.append(float(budget_str)); continue
            if isinstance(budget_str, str):

                try:

                    cleaned_budget = re.sub(r'[^\d.]', '', budget_str);
                    if cleaned_budget: budgets.append(float(cleaned_budget))
                except ValueError: logger.warning(f"Could not parse budget: {budget_str}"); pass

        if budgets: avg_budget = sum(budgets) / len(budgets); avg_budget_str = f"PHP {avg_budget:,.2f}"
        else: avg_budget_str = "N/A"

        prompt_sections = [f"Analyze Sangguniang Kabataan (SK) project data specific to National Capital Region (NCR), Quezon City, Philippines.", f"Category: '{category}'", f"Time Frame: {time_frame}", f"Records Analyzed: {len(filtered_data)}", f"Avg Budget: {avg_budget_str} ({len(budgets)} valid)"]
        if simplified_data: prompt_sections.append(f"\nSample Data (max {max_items}):\n{json.dumps(simplified_data, separators=(',', ':'))}")
        else: prompt_sections.append("\nNo project data samples provided.")
        if search_results: prompt_sections.append("\nWeb Search Results:\n" + "\n".join([f"- {res['title']}: {res['snippet']}" for res in search_results]))

        prompt_sections.append("\nGenerate a JSON response with requested components (based on 'include_' flags):")
        structure_description = {}
        if options.get('include_success_factors', True): structure_description["success_factors"] = ["Factor 1...", "Factor 2..."]
        if options.get('include_recommendations', True): structure_description["recommendations"] = ["Rec 1...", "Rec 2..."]
        if options.get('include_risks', True): structure_description["risks"] = [{"risk": "Risk description", "mitigation": "Mitigation strategy"}]
        if options.get('include_trends', True): structure_description["trends"] = ["Trend 1...", "Trend 2..."]
        if options.get('include_budget', True): structure_description["budget_analysis"] = {"currency": "PHP", "average_numeric": avg_budget if budgets else None, "comment": "Comment..."}
        if options.get('include_implement_date', True): structure_description["typical_implementation_timeline"] = "Timeline..."
        if options.get('include_duration', True): structure_description["typical_duration"] = "Duration..."
        if options.get('include_feedback', True): structure_description["potential_feedback_areas"] = ["Area 1...", "Area 2..."]
        structure_description["analysis_summary"] = "Summary..."
        prompt_sections.append(json.dumps(structure_description, indent=2))
        prompt_sections.append("\nIMPORTANT: Respond ONLY with valid JSON object. No extra text/markdown.")
        prompt_sections.append("\nIMPORTANT: Focus exclusively on NCR region and Quezon City. Do NOT mention or reference other regions like CALABARZON.")
        final_prompt = "\n".join(prompt_sections)
        logger.info(f"Constructed prompt length: {len(final_prompt)} chars")
        return final_prompt


    def _generate_with_gemini(self, prompt):
        """Generates response using Gemini and parses JSON robustly. Returns dict."""

        if not self.model: logger.warning("Gemini model unavailable."); return {"error": "Gemini AI model unavailable.", "status": "failed"}
        logger.info("Sending prompt to Gemini...")
        response_text = ""; parsed_json = None; json_str = None
        try:

            response = self.model.generate_content(prompt)
 
            try:

                if hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
                    reason = response.prompt_feedback.block_reason; details = f"Reason: {reason}"
                    if hasattr(response.prompt_feedback, 'safety_ratings'): details += f" | Ratings: {response.prompt_feedback.safety_ratings}"
                    logger.error(f"Gemini blocked. {details}")
                    return {"error": "AI blocked (safety).", "status": "failed", "details": details}
            except Exception as fb_err: logger.warning(f"Feedback check error: {fb_err}")


            try: response_text = response.text.strip()
            except (ValueError, AttributeError): response_text = ""
            if not response_text and hasattr(response, 'parts'):

                try:
                    response_text = "".join(part.text for part in response.parts).strip()
                    if response_text: logger.info("Got text from parts.")
                    else: logger.warning("Parts had no text.")
                except Exception as parts_err: logger.warning(f"Parts error: {parts_err}")
            if not response_text:

                 logger.error("Failed text extraction.")
                 details = "No text in response."
                 if hasattr(response, 'candidates'): details += f" | Candidates: {response.candidates}"
                 return {"error": "Empty/unreadable AI response.", "status": "failed", "details": details}

            logger.info(f"Raw response received (len: {len(response_text)})")
            # Parse JSON attempts
            try:
                parsed_json = json.loads(response_text)
                if isinstance(parsed_json, dict): return parsed_json
                else: logger.warning(f"Parsed not dict: {type(parsed_json)}"); parsed_json = None
            except json.JSONDecodeError as e: logger.debug(f"Direct parse failed: {e}. Context: ...{repr(response_text[max(0, e.pos-20):min(len(response_text), e.pos+20)])}...")
            code_block_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL | re.IGNORECASE)
            if code_block_match:
                json_str = code_block_match.group(1).strip(); logger.info("Found JSON in code block.")
                try:
                    parsed_json = json.loads(json_str); logger.info("Parsed from code block.")
                    if isinstance(parsed_json, dict): return parsed_json
                    else: logger.warning(f"Parsed code block not dict: {type(parsed_json)}"); parsed_json = None
                except json.JSONDecodeError as e: logger.warning(f"Failed code block parse: {e}"); logger.debug(f"Code block parse context: ...{repr(json_str[max(0, e.pos-20):min(len(json_str), e.pos+20)])}...")

            first_brace = response_text.find('{'); last_brace = response_text.rfind('}')
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                potential_json = response_text[first_brace:last_brace+1]; logger.info("Attempting parse extracted object.")
                try:
                    parsed_json = json.loads(potential_json); logger.info("Parsed extracted object.")
                    if isinstance(parsed_json, dict): return parsed_json
                    else: logger.warning(f"Parsed extracted obj not dict: {type(parsed_json)}"); parsed_json = None
                except json.JSONDecodeError as e: logger.warning(f"Failed extracted obj parse: {e}"); logger.debug(f"Extracted obj parse context: ...{repr(potential_json[max(0, e.pos-20):min(len(potential_json), e.pos+20)])}...")

            logger.error("Failed to parse valid JSON dict.")
            error_detail = response_text[:200] + "..." if len(response_text) > 200 else response_text
            return {"error": "Failed to parse JSON from AI.", "status": "failed", "raw_response_preview": error_detail}

        except Exception as e: 
            logger.error(f"Error during Gemini call or processing: {str(e)}", exc_info=True)
            error_details = str(e)
            try: 
                if hasattr(e, 'response') and hasattr(e.response, 'prompt_feedback'):
                    error_details += f" | Feedback: {e.response.prompt_feedback}"
            except Exception: 
                pass 
            return {"error": "Error during AI generation/parsing.", "status": "failed", "details": error_details}


    def analyze(self, options):
        """Main analysis method using OAuth for Sheets."""
        # Level 1
        logger.info(f"Starting analysis: {options}"); start_time = datetime.now()
        result = {"analysis_metadata": {"timestamp": start_time.isoformat(),"analysis_type": "customized","requested_category": options.get('category', 'N/A'),"requested_time_period": options.get('time_period', 'N/A'),"requested_time_detail": options.get('time_detail', 'N/A'),"spreadsheet_data_points_analyzed": 0,"internet_search_performed": False,"ai_model_used": self.model_name if self.model else "N/A"},"analysis_results": {"status": "pending"}}
        try:
            primary_data = self.get_spreadsheet_data()
            if not primary_data: logger.warning("No spreadsheet data.")
            result["analysis_metadata"]["spreadsheet_data_points_analyzed"] = len(primary_data)
            category = options.get('category', ''); filtered_data = primary_data
            if category and category.lower() != 'all' and category.lower() != 'none' and primary_data:
                filtered_data = [item for item in primary_data if item.get('category', '').strip().lower() == category.strip().lower()]
                logger.info(f"Filtered '{category}'. {len(filtered_data)} records.")
                if not filtered_data: logger.warning(f"No data matches category: '{category}'.")
                result["analysis_metadata"]["spreadsheet_data_points_analyzed"] = len(filtered_data)
            else: logger.info("Using all spreadsheet data (or category is None/All).")

            search_results = None
            if options.get('include_trends', False) and self.search_service:
                search_term = f"Sangguniang Kabataan NCR Quezon City {category if category and category.lower() != 'none' else ''} projects trends Philippines {options.get('time_detail', '')}".strip().replace("  ", " ")
                search_results = self.search_internet(search_term)
                result["analysis_metadata"]["internet_search_performed"] = bool(search_results)

            if self.model:
                prompt = self._construct_gemini_prompt(options, filtered_data, search_results)
                gemini_response = self._generate_with_gemini(prompt)
                if isinstance(gemini_response, dict):
                    result["analysis_results"] = gemini_response;
                    if "error" in result["analysis_results"]: result["analysis_results"]["status"] = "failed"; logger.error(f"Error from Gemini: {result['analysis_results']}")
                    else: result["analysis_results"]["status"] = "success"; logger.info("Got Gemini analysis.")
                else: logger.error(f"Invalid Gemini response type: {type(gemini_response)}"); result["analysis_results"] = {"error": "Invalid AI response format.", "status": "failed", "details": f"Expected dict, got {type(gemini_response)}"}
            else: logger.warning("Gemini unavailable."); result["analysis_results"] = {"error": "AI analysis skipped.", "status": "skipped", "details": "Check API Key/libs."}

            end_time = datetime.now(); duration = (end_time - start_time).total_seconds(); result["analysis_metadata"]["processing_duration_seconds"] = round(duration, 2)
            logger.info(f"Analysis complete ({duration:.2f}s). Status: {result['analysis_results'].get('status', 'unknown')}")
            return result 

        except Exception as e: 
            logger.error(f"Critical analysis error: {str(e)}", exc_info=True)
            result["analysis_results"] = {"error": "Unexpected critical error.", "status": "failed", "details": str(e)}
            end_time = datetime.now(); duration = (end_time - start_time).total_seconds()
            if "analysis_metadata" in result: 
                 result["analysis_metadata"]["processing_duration_seconds"] = round(duration, 2)
            else:
                 result["analysis_metadata"] = {"processing_duration_seconds": round(duration, 2)}
            return result 


# --- Main Handler Function ---
def handle_customized_analysis(request_json):
    """Main handler using OAuth for Sheets."""

    logger.info(f"Received request: {request_json}")
    if not isinstance(request_json, dict):

        logger.error("Invalid request format.")
        error_response = DEFAULT_JSON_RESPONSE.copy(); error_response["error"] = "Invalid request format."
        return error_response
    if not google_api_available or not genai_available:

        logger.error("Core library missing.")
        error_response = DEFAULT_JSON_RESPONSE.copy(); error_response["error"] = "Core library missing."
        error_response["details"] = f"Google API: {google_api_available}, GenAI: {genai_available}. Check installs."
        return error_response
    try: 
        analyzer = CustomizedAnalysis()
        result = analyzer.analyze(request_json)
        try: 
            # Ensure the final output to stdout is only the JSON string
            final_json_output = json.dumps(result, indent=2) # Indent for readability if needed
            # CRITICAL: Print ONLY the JSON string to stdout
            print(final_json_output)
            logger.info("Analysis complete, JSON output printed to stdout.")
            # Return the dictionary for potential internal use if this script is imported elsewhere
            return result
        except TypeError as json_error:

            logger.error(f"Serialization error: {str(json_error)}", exc_info=True)
            fallback_error = DEFAULT_JSON_RESPONSE.copy(); fallback_error["error"] = "Result not JSON serializable."; fallback_error["details"] = f"{str(json_error)}."
            # Print the error JSON to stdout for the caller
            print(json.dumps(fallback_error, indent=2))
            return fallback_error
    except Exception as e: 

        logger.error(f"Critical handler error: {str(e)}", exc_info=True)
        # Print the default error JSON to stdout for the caller
        print(json.dumps(DEFAULT_JSON_RESPONSE, indent=2))
        return DEFAULT_JSON_RESPONSE 

# --- Execution Block ---
if __name__ == '__main__':

    input_options = {}
    # Check if command line arguments were provided
    if len(sys.argv) > 1:
        try:

            input_options = json.loads(sys.argv[1])
        except json.JSONDecodeError:

            logger.error("Invalid JSON input from command line.")
            # Print error JSON to stdout so Node.js gets *something* parseable
            print(json.dumps({"error": "Invalid JSON input from Node.js", "status": "failed"}), file=sys.stdout)
            sys.exit(1)
        except Exception as arg_err:

             logger.error(f"Error processing command line args: {arg_err}")
             print(json.dumps({"error": f"Error processing arguments: {arg_err}", "status": "failed"}), file=sys.stdout)
             sys.exit(1)
    else:
        # Handle case where no options were provided (e.g., run directly without args)
        logger.warning("No command line options provided. Using default test options.")

    # Call the handler function which now prints the final JSON itself
    handle_customized_analysis(input_options)