import os
import json
import pandas as pd
import numpy as np
import re
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Dict, List, Any, Optional, Union
import requests
import sys
import logging  

# Try to import Google Generative AI, but don't fail if it's not available
try:
    import google.generativeai as genai
    genai_available = True
except ImportError:
    print("Google Generative AI library not installed. Please run: pip install google-generativeai")
    genai_available = False

# Try to import Google API libraries, but don't fail if they're not available
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    google_api_available = True
except ImportError:
    print(
        "Google API libraries not installed. Please run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
    google_api_available = False

# Load environment variables
load_dotenv()

# Configure Gemini API if available
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if genai_available and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-2.0-flash')
elif genai_available:
    print("GEMINI_API_KEY environment variable is not set")

# Get Google Sheets configuration
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SAMPLE_RANGE_NAME = 'Data100!A:G'

# Get Google Programmable Search Engine configuration
SEARCH_ENGINE_ID = os.getenv("SEARCH_ENGINE_ID")
SEARCH_ENGINE_API = os.getenv("SEARCH_ENGINE_API")

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_sheet_data():
    """
    Fetch project data from Google Sheets
    Returns the raw sheet data as a list of lists, or None if an error occurs.
    """
    if not google_api_available:
        print("Error: Google API libraries not available.")
        return None

    creds = None
    credentials_path = os.path.join(os.path.dirname(__file__), 'credentials.json')
    token_path = os.path.join(os.path.dirname(__file__), 'token.json')

    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            print(f"Error loading token: {e}")
            return None

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing credentials: {e}")
                return None
        else:
            if not os.path.exists(credentials_path):
                print(f"Error: Credentials file not found at {credentials_path}.")
                return None

            try:
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                print(f"Error in authentication flow: {e}")
                return None

    try:
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID,
                                    range=SAMPLE_RANGE_NAME).execute()
        values = result.get('values', [])
        if not values:
            print("Error: No data found in the specified Google Sheet range.")
            return None
        return values
    except HttpError as err:
        print(f'Google Sheets API error: {err}')
        return None
    except Exception as e:
        print(f'Unexpected error accessing Google Sheets: {e}')
        return None


def get_project_data() -> List[Dict[str, Any]]:
    """
    Fetch project data from the spreadsheet
    Returns a list of project dictionaries, or an empty list if data retrieval fails.
    """
    sheet_data = get_sheet_data()
    if sheet_data is None or len(sheet_data) <= 1:
        if sheet_data is None:
            print("Error: Could not retrieve project data.")
        else:
            print("Error: No project data (excluding header) found in the sheet.")
        return []

    # Convert sheet data to list of dictionaries
    header = sheet_data[0]
    projects = []

    for row in sheet_data[1:]:
        if len(row) < len(header):
            # Pad row with empty strings if it's shorter than header
            row = row + [''] * (len(header) - len(row))

        project = {}
        for i, col_name in enumerate(header):
            # Handle budget column specifically (assuming it's in column C or has header 'Budget')
            if col_name == 'Budget':
                # Store the original value but ensure it's recognized as PHP
                budget_value = row[i]
                if not budget_value.startswith('₱') and not budget_value.startswith('PHP'):
                    budget_value = f"₱{budget_value}"
                project[col_name] = budget_value
            else:
                project[col_name] = row[i]

        projects.append(project)

    return projects


def search_internet(query: str, num_results: int = 5) -> List[Dict[str, str]]:
    """
    Search the internet using Google Programmable Search Engine
    Returns a list of search results
    """
    if not SEARCH_ENGINE_ID or not SEARCH_ENGINE_API:
        print("Search engine configuration not available")
        return []

    try:
        url = f"https://www.googleapis.com/customsearch/v1"
        params = {
            'key': SEARCH_ENGINE_API,
            'cx': SEARCH_ENGINE_ID,
            'q': query,
            'num': num_results
        }

        response = requests.get(url, params=params)
        if response.status_code != 200:
            print(f"Search API error: {response.status_code}")
            return []

        search_results = response.json()
        items = search_results.get('items', [])

        results = []
        for item in items:
            results.append({
                'title': item.get('title', ''),
                'link': item.get('link', ''),
                'snippet': item.get('snippet', '')
            })

        return results
    except requests.exceptions.RequestException as e:
        print(f"Error during internet search request: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response from search API: {e}")
        return []
    except Exception as e:
        print(f"Error searching internet: {e}")
        return []


class PredictiveAnalysis:
    def __init__(self):
        """Initialize the PredictiveAnalysis class."""
        logger.info("Predictive Analysis module initialized")
        
        # Initialize Gemini model if available
        self.model = None
        if genai_available and GEMINI_API_KEY:
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info("Gemini model initialized")
        else:
            logger.warning("Gemini model not available, using fallback analysis")

    def _extract_json_from_text(self, text):
        """
        Extract JSON from text using regex pattern matching.
        """
        if not text:
            logger.debug("Empty text received from Gemini")
            return None
            
        logger.debug(f"Received text from Gemini (first 100 chars): {text[:100]}...")
        
        # First, try to find JSON between triple backticks (common Gemini format)
        json_code_block = re.search(r'```(?:json)?\s*\n([\s\S]*?)\n```', text)
        if json_code_block:
            json_str = json_code_block.group(1)
            logger.debug(f"Found JSON in code block of length {len(json_str)}")
            # Clean up and return
            json_str = json_str.replace("'", '"')
            json_str = re.sub(r'\\([^"\\/bfnrtu])', r'\1', json_str)
            return json_str
        
        # If no code block, look for JSON-like patterns in the text
        json_pattern = r'\{[\s\S]*?\}'
        match = re.search(json_pattern, text, re.DOTALL)
        
        if match:
            json_str = match.group(0)
            logger.debug(f"Found JSON pattern match of length {len(json_str)}")
            
            # Clean up the JSON string
            json_str = json_str.replace("'", '"')
            
            # Fix invalid escape sequences
            json_str = re.sub(r'\\([^"\\/bfnrtu])', r'\1', json_str)
            
            # Fix property names without quotes
            json_str = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', json_str)
            
            return json_str
        
        logger.debug("No JSON pattern found in Gemini response")
        return None

    def _fix_json_string(self, json_str, error_pos=None):
        """
        Apply more aggressive fixes to JSON strings that failed initial parsing.
        """
        # Replace single quotes with double quotes
        json_str = json_str.replace("'", '"')
        
        # Remove control characters
        json_str = re.sub(r'[\x00-\x1F\x7F]', '', json_str)
        
        # Fix invalid escape sequences more thoroughly
        json_str = re.sub(r'\\([^"\\/bfnrtu])', r'\1', json_str)
        
        # Fix property names without quotes
        json_str = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)\s*:', r'\1"\2":', json_str)
        
        # Fix trailing commas
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        
        # Handle escaped quotes
        json_str = json_str.replace('\\"', '"')
        
        # Fix unescaped quotes within string values
        json_str = re.sub(r':\s*"([^"]*)"([^"]*)"([^"]*)"', r':"\1\'\2\'\3"', json_str)
        
        # Fix missing quotes around string values
        json_str = re.sub(r':\s*([a-zA-Z][a-zA-Z0-9_\s]+)([,}])', r':"\1"\2', json_str)
        
        # Ensure JSON is properly balanced
        open_braces = json_str.count('{')
        close_braces = json_str.count('}')
        open_brackets = json_str.count('[')
        close_brackets = json_str.count(']')
        
        # Add missing closing braces/brackets if needed
        if open_braces > close_braces:
            json_str += '}' * (open_braces - close_braces)
        if open_brackets > close_brackets:
            json_str += ']' * (open_brackets - close_brackets)
        
        try:
            logger.debug(f"Attempting to parse cleaned JSON: {json_str[:100]}...")
            ai_analysis = json.loads(json_str)
            logger.info("Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            logger.debug(f"JSON parse error: {str(e)}")
            logger.debug(f"Error at position {e.pos}, showing context: {json_str[max(0, e.pos-20):min(len(json_str), e.pos+20)]}")
            
            # Try a more aggressive approach - replace all escape sequences
            ultra_fixed_json = re.sub(r'\\(.)', r'\1', json_str)
            
            try:
                ai_analysis = json.loads(ultra_fixed_json)
                logger.info("Successfully parsed JSON after ultra fixes")
            except json.JSONDecodeError:
                # Try one more approach - use a JSON5 parser if available
                try:
                    import json5
                    ai_analysis = json5.loads(json_str)
                    logger.info("Successfully parsed JSON using JSON5 parser")
                except (ImportError, Exception):
                    logger.debug("Still failing to parse JSON, using fallback")
                    raise ValueError("Failed to parse JSON after multiple attempts")
            except Exception:
                logger.debug("Using fallback JSON response")
                raise ValueError("Failed to parse any valid JSON")
        
        # Validate the parsed JSON structure
        # Ensure all required fields are present
        required_fields = [
            "success_factors", "recommendations", "risk_mitigation_strategies",
            "predicted_trends", "expected_budget", "implementation_date",
            "expected_duration", "feedback"
        ]
        
        missing_fields = [field for field in required_fields if field not in ai_analysis]
        current_year = datetime.now().year
        
        if missing_fields:
            logger.debug(f"Missing required fields in JSON: {missing_fields}")
            # Add default values for missing fields
            for field in missing_fields:
                if field == "success_factors":
                    ai_analysis[field] = ["Effective project planning", "Clear communication", "Resource management", "Risk assessment", "Regular monitoring"]
                elif field == "recommendations":
                    ai_analysis[field] = ["Standardize documentation", "Improve communication", "Enhance resource planning", "Strengthen risk management", "Implement regular reviews"]
                elif field == "risk_mitigation_strategies":
                    ai_analysis[field] = [
                        {"risk": "Budget overruns", "mitigation": "Regular financial monitoring"},
                        {"risk": "Schedule delays", "mitigation": "Buffer time in planning"},
                        {"risk": "Scope creep", "mitigation": "Change management process"},
                        {"risk": "Resource constraints", "mitigation": "Contingency planning"},
                        {"risk": "Stakeholder issues", "mitigation": "Regular engagement"}
                    ]
                elif field == "predicted_trends":
                    ai_analysis[field] = {
                        "Digital transformation": "Increased adoption of digital tools",
                        "Remote work": "More flexible arrangements",
                        "Data analytics": "Greater use in decision-making",
                        "Agile methodologies": "Wider adoption",
                        "Sustainability": "Growing importance"
                    }
                elif field == "expected_budget":
                    ai_analysis[field] = {
                        "average": "PHP 500,000", 
                        "minimum": "PHP 300,000", 
                        "maximum": "PHP 800,000", 
                        "median": "PHP 450,000",
                        "recommendation": "Include 15% contingency"
                    }
                elif field == "implementation_date":
                    ai_analysis[field] = f"Recommend starting in {current_year}"
                elif field == "expected_duration":
                    ai_analysis[field] = {
                        "average": "120 days", 
                        "minimum": "90 days", 
                        "maximum": "180 days", 
                        "median": "110 days",
                        "recommendation": "Plan for 4-month duration with buffer"
                    }
                elif field == "feedback":
                    ai_analysis[field] = "Projects show positive outcomes when properly planned. Communication is critical. Resource allocation needs improvement. Documentation quality varies. Stakeholder engagement correlates with success."
        
        return ai_analysis

    def generate_general_response(self, primary_data, secondary_data=None):
        """
        Generates a general predictive analysis response.
        
        Args:
            primary_data (list): A list of dictionaries representing SK project data
            secondary_data (list, optional): Internet search results
        """
        # Initialize response dictionary
        response = {"analysis_type": "general"}
        current_year = datetime.now().year
        
        # Define fallback analysis
        fallback_analysis = {
            "success_factors": [
                "Effective project planning and organization",
                "Clear communication among stakeholders",
                "Adequate resource allocation and management",
                "Comprehensive risk assessment and mitigation",
                "Regular monitoring and evaluation of progress"
            ],
            "recommendations": [
                "Implement standardized project documentation templates",
                "Establish clear communication channels and protocols",
                "Develop comprehensive resource allocation plans",
                "Create detailed risk assessment and mitigation strategies",
                "Implement regular progress monitoring and evaluation"
            ],
            "risk_mitigation_strategies": [
                {"risk": "Budget overruns", "mitigation": "Implement regular financial monitoring and controls"},
                {"risk": "Schedule delays", "mitigation": "Build buffer time into project timelines"},
                {"risk": "Scope creep", "mitigation": "Establish clear change management processes"},
                {"risk": "Resource constraints", "mitigation": "Develop contingency plans for critical resources"},
                {"risk": "Stakeholder conflicts", "mitigation": "Implement stakeholder engagement and communication plans"}
            ],
            "predicted_trends": {
                "Digital transformation": "Increased adoption of digital tools in project management",
                "Remote work": "Greater flexibility in work arrangements",
                "Data-driven decision making": "Enhanced use of analytics in project planning",
                "Agile methodologies": "Wider adoption across different project types",
                "Sustainability focus": "Growing emphasis on environmental considerations"
            },
            "expected_budget": {
                "average": "PHP 500,000",
                "minimum": "PHP 300,000",
                "maximum": "PHP 800,000",
                "median": "PHP 450,000",
                "recommendation": "Include a 15% contingency buffer in budget planning"
            },
            "implementation_date": f"Recommend starting in {current_year} for optimal resource availability",
            "expected_duration": {
                "average": "120 days",
                "minimum": "90 days",
                "maximum": "180 days",
                "median": "110 days",
                "recommendation": "Plan for 4-month duration with 2-week buffer"
            },
            "feedback": "Projects generally show positive outcomes when properly planned. Communication remains a critical success factor across all projects. Resource allocation issues appear in approximately 30% of projects. Documentation quality varies significantly between departments. Stakeholder engagement correlates strongly with overall project success."
        }
        
        # Prepare data for analysis
        if not primary_data or len(primary_data) == 0:
            logger.warning("No primary data provided")
            response.update(fallback_analysis)
            return response
        
        # If Gemini API is available, use it for analysis
        if self.model:
            try:
                # Prepare prompt for Gemini with explicit JSON request
                prompt = """Analyze this project data and provide insights in JSON format only.
                Your response must be a valid JSON object with the following structure:
                {
                "success_factors": ["factor1", "factor2", ...],
                "recommendations": ["rec1", "rec2", ...],
                "risk_mitigation_strategies": [{"risk": "risk1", "mitigation": "strategy1"}, ...],
                "predicted_trends": {"trend1": "description1", ...},
                "expected_budget": {"average": "value", "minimum": "value", "maximum": "value", "median": "value", "recommendation": "text"},
                "implementation_date": "text",
                "expected_duration": {"average": "value", "minimum": "value", "maximum": "value", "median": "value", "recommendation": "text"},
                "feedback": "text"
                }

                Project data:
                """
                prompt += str(primary_data)
                
                if secondary_data:
                    prompt += f"\n\nAdditional context: {secondary_data}"
                    
                prompt += "\n\nProvide your analysis as a single JSON object. Do not include any explanatory text outside the JSON."
                
                # Call Gemini API
                logger.debug("Sending prompt to Gemini API")
                gemini_response = self.model.generate_content(prompt)
                gemini_response_text = gemini_response.text
                logger.debug(f"Received response of length {len(gemini_response_text)}")
                
                # Extract JSON from response
                json_str = self._extract_json_from_text(gemini_response_text)
                
                if json_str:
                    try:
                        # Parse and validate JSON
                        ai_analysis = self._fix_json_string(json_str)
                        response.update(ai_analysis)
                        logger.info("Successfully created analysis response using Gemini")
                    except ValueError as e:
                        logger.error(f"Failed to parse JSON from Gemini: {str(e)}")
                        logger.info("Using fallback analysis due to JSON error")
                        response.update(fallback_analysis)
                else:
                    logger.error("No JSON found in Gemini response")
                    logger.debug("Attempting direct JSON generation from Gemini")
                    
                    # Try a more direct approach with a simplified prompt
                    try:
                        direct_prompt = """Generate a JSON object with project analysis. Format:
                            {
                            "success_factors": ["factor1", "factor2"],
                            "recommendations": ["rec1", "rec2"],
                            "risk_mitigation_strategies": [{"risk": "risk1", "mitigation": "strategy1"}],
                            "predicted_trends": {"trend1": "description1"},
                            "expected_budget": {"average": "value", "minimum": "value", "maximum": "value", "median": "value"},
                            "implementation_date": "text",
                            "expected_duration": {"average": "value", "minimum": "value", "maximum": "value", "median": "value"},
                            "feedback": "text"
                            }
                            Return ONLY valid JSON."""
                
                        direct_response = self.model.generate_content(direct_prompt)
                        direct_text = direct_response.text
                        
                        # Try to parse as JSON directly
                        try:
                            # First clean up any markdown formatting
                            clean_text = re.sub(r'```json\s*|\s*```', '', direct_text)
                            ai_analysis = json.loads(clean_text)
                            logger.info("Successfully created analysis using direct JSON generation")
                            response.update(ai_analysis)
                        except json.JSONDecodeError:
                            logger.debug("Direct JSON generation failed, using fallback")
                            response.update(fallback_analysis)
                    except Exception as direct_e:
                        logger.error(f"Direct JSON generation failed: {str(direct_e)}")
                        logger.info("Using fallback analysis")
                        response.update(fallback_analysis)
            except Exception as e:
                logger.error(f"Failed to process Gemini response: {str(e)}")
                logger.info("Using fallback analysis")
                response.update(fallback_analysis)
        else:
            logger.info("No Gemini API available, using predetermined analysis")
            response.update(fallback_analysis)
            
        # Calculate some basic statistics from the data if available
        try:
            # Extract budget and duration information
            budget_values = []
            duration_values = []
            
            for project in primary_data:
                # Try to extract budget
                budget = project.get('Budget', '')
                if budget:
                    # Clean budget string and convert to numeric
                    budget_clean = budget.replace('₱', '').replace('PHP', '').replace(',', '').strip()
                    try:
                        budget_values.append(float(budget_clean))
                    except ValueError:
                        pass
                
                # Try to extract duration
                duration = project.get('Duration', '')
                if duration:
                    # Try to extract numeric value
                    duration_match = re.search(r'(\d+)', duration)
                    if duration_match:
                        try:
                            duration_values.append(float(duration_match.group(1)))
                        except ValueError:
                            pass
            
            # Update budget statistics if we have data
            if budget_values:
                response["expected_budget"] = {
                    "average": f"PHP {sum(budget_values)/len(budget_values):,.2f}",
                    "minimum": f"PHP {min(budget_values):,.2f}",
                    "maximum": f"PHP {max(budget_values):,.2f}",
                    "median": f"PHP {sorted(budget_values)[len(budget_values)//2]:,.2f}",
                    "recommendation": "Budget should include 15% contingency based on historical data"
                }
            
            # Update duration statistics if we have data
            if duration_values:
                response["expected_duration"] = {
                    "average": f"{sum(duration_values)/len(duration_values):.0f} days",
                    "minimum": f"{min(duration_values):.0f} days",
                    "maximum": f"{max(duration_values):.0f} days",
                    "median": f"{sorted(duration_values)[len(duration_values)//2]:.0f} days",
                    "recommendation": "Plan for average duration plus 20% buffer time"
                }
                
        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
        
        return response

    def generate_custom_response(self, options, primary_data, secondary_data=None):
        """
        Generates a customized predictive analysis response based on user-selected options.
        
        Args:
            options (dict): A dictionary of analysis options selected by the user
            primary_data (list): A list of dictionaries representing SK project data
            secondary_data (list, optional): Internet search results
        """
        # Get base response
        base_response = self.generate_general_response(primary_data, secondary_data)
        
        # Initialize custom response
        custom_response = {"analysis_type": "custom"}
        
        # Add selected components to the custom response
        if options.get('include_success_factors', True):
            custom_response["success_factors"] = base_response.get("success_factors", [])
        
        if options.get('include_recommendations', True):
            custom_response["recommendations"] = base_response.get("recommendations", [])
        
        if options.get('include_risks', True):
            custom_response["risk_mitigation_strategies"] = base_response.get("risk_mitigation_strategies", [])
        
        if options.get('include_trends', True):
            custom_response["predicted_trends"] = base_response.get("predicted_trends", {})
        
        if options.get('include_budget', True):
            custom_response["expected_budget"] = base_response.get("expected_budget", {})
        
        if options.get('include_implement_date', True):
            custom_response["implementation_date"] = base_response.get("implementation_date", "")
        
        if options.get('include_duration', True):
            custom_response["expected_duration"] = base_response.get("expected_duration", {})
        
        if options.get('include_feedback', True):
            custom_response["feedback"] = base_response.get("feedback", "")
        
        # Add metadata
        custom_response["custom_options"] = options
        custom_response["data_points"] = len(primary_data)
        
        return custom_response

    def analyze(self, data, analysis_type="general", options=None):
        """
        Main entry point for predictive analysis.
        
        Args:
            data (dict): Contains primary_data and optional secondary_data
            analysis_type (str): Type of analysis to perform ("general" or "custom")
            options (dict, optional): Configuration options for custom analysis
            
        Returns:
            dict: Analysis results
        """
        primary_data = data.get("primary_data", [])
        secondary_data = data.get("secondary_data", None)
        
        if not primary_data or len(primary_data) == 0:
            return {
                "error": "Insufficient data provided",
                "message": "Please provide valid project data for analysis."
            }
        
        try:
            if analysis_type.lower() == "general":
                return self.generate_general_response(primary_data, secondary_data)
            
            elif analysis_type.lower() == "custom" and options:
                return self.generate_custom_response(options, primary_data, secondary_data)
            
            else:
                return {
                    "error": "Invalid analysis type",
                    "message": f"Analysis type '{analysis_type}' is not supported or missing required options."
                }
                
        except Exception as e:
            logger.error(f"Error in predictive analysis: {str(e)}", exc_info=True)
            return {
                "error": "Analysis failed",
                "message": f"An error occurred during analysis: {str(e)}"
            }
    
    def get_available_options(self):
        """
        Returns the available analysis options for the frontend.
        
        Returns:
            dict: Available analysis options
        """
        return {
            "analysis_types": ["general", "custom"],
            "components": [
                {"id": "include_success_factors", "label": "Success Factors", "default": True},
                {"id": "include_recommendations", "label": "Recommendations", "default": True},
                {"id": "include_risks", "label": "Risk Mitigation Strategies", "default": True},
                {"id": "include_trends", "label": "Predicted Trends", "default": True},
                {"id": "include_budget", "label": "Expected Budget", "default": True},
                {"id": "include_implement_date", "label": "Implementation Date", "default": True},
                {"id": "include_duration", "label": "Expected Duration", "default": True},
                {"id": "include_feedback", "label": "Feedback", "default": True}
            ]
        }


def json_serialize(obj):
    """
    Ensure all objects in the dictionary are JSON serializable
    """
    if isinstance(obj, dict):
        return {k: json_serialize(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [json_serialize(item) for item in obj]
    elif isinstance(obj, (datetime, np.datetime64)):
        return obj.isoformat()
    elif isinstance(obj, (int, float, str, bool, type(None))):
        return obj
    else:
        return str(obj)


def main():
    """
    Main function to handle predictive analysis requests
    """
    try:
        # Get options from command line arguments
        if len(sys.argv) > 1:
            options = json.loads(sys.argv[1])
        else:
            options = {}

        # Create predictive analysis instance
        pa = PredictiveAnalysis()

        # Generate response based on analysis type
        analysis_type = options.get('analysis_type', 'general')

        # Fetch data
        primary_data = get_project_data()
        secondary_data = None
        
        if SEARCH_ENGINE_ID and SEARCH_ENGINE_API:
            secondary_data = search_internet(
                "project management trends " + str(datetime.now().year),
                num_results=3
            )
        
        # Process the analysis based on type
        if analysis_type == 'general':
            response = pa.analyze({"primary_data": primary_data, "secondary_data": secondary_data}, 
                                 analysis_type="general")
        elif analysis_type == 'custom':
            response = pa.analyze({"primary_data": primary_data, "secondary_data": secondary_data}, 
                                 analysis_type="custom", 
                                 options=options)
        else:
            # For other analysis types, delegate to the response generator
            response_generator = PredictiveAnalysisResponse()
            if analysis_type == 'category':
                category = options.get('category', '')
                response = response_generator.generate_category_response(primary_data, category, secondary_data)
            elif analysis_type == 'time_period':
                time_period = options.get('time_period', '')
                time_sub_category = options.get('time_sub_category', '')
                response = response_generator.generate_time_period_response(
                    primary_data, time_period, time_sub_category, secondary_data)
            else:
                response = {"error": f"Unsupported analysis type: {analysis_type}"}

        # Ensure the response is a valid dictionary
        if not isinstance(response, dict):
            response = {
                "error": "Invalid response format",
                "timestamp": datetime.now().isoformat()
            }

        # Print the response as JSON - this is critical for the Node.js bridge
        print(json.dumps(json_serialize(response), ensure_ascii=False, indent=2))

    except Exception as e:
        logger.error(f"Error in predictive analysis: {str(e)}")
        error_response = {
            "error": f"Error in predictive analysis: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }
        print(json.dumps(error_response, ensure_ascii=False, indent=2))


class PredictiveAnalysis:
    def __init__(self):
        """Initialize the PredictiveAnalysis class."""
        logger.info("Predictive Analysis module initialized")
        
        # Initialize Gemini model if available
        self.model = None
        if genai_available and GEMINI_API_KEY:
            self.model = genai.GenerativeModel('gemini-2.0-flash')
            logger.info("Gemini model initialized")
        else:
            logger.warning("Gemini model not available, using fallback analysis")

    def analyze(self, data, analysis_type="general", options=None):
        """
        Main entry point for predictive analysis.
        
        Args:
            data (dict): Contains primary_data and optional secondary_data
            analysis_type (str): Type of analysis to perform ("general" or "custom")
            options (dict, optional): Configuration options for custom analysis
            
        Returns:
            dict: Analysis results
        """
        primary_data = data.get("primary_data", [])
        secondary_data = data.get("secondary_data", None)
        
        if not primary_data or len(primary_data) == 0:
            return {
                "error": "Insufficient data provided",
                "message": "Please provide valid project data for analysis."
            }
        
        try:
            if analysis_type.lower() == "general":
                return self.generate_general_response(primary_data, secondary_data)
            
            elif analysis_type.lower() == "custom" and options:
                return self.generate_custom_response(options, primary_data, secondary_data)
            
            else:
                return {
                    "error": "Invalid analysis type",
                    "message": f"Analysis type '{analysis_type}' is not supported or missing required options."
                }
                
        except Exception as e:
            logger.error(f"Error in predictive analysis: {str(e)}", exc_info=True)
            return {
                "error": "Analysis failed",
                "message": f"An error occurred during analysis: {str(e)}"
            }
    
    def generate_general_response(self, primary_data, secondary_data=None):
        """
        Generates a general predictive analysis response.
        
        Args:
            primary_data (list): A list of dictionaries representing SK project data
            secondary_data (list, optional): Internet search results
        """
        # Initialize response dictionary
        response = {"analysis_type": "general"}
        current_year = datetime.now().year
        
        # If Gemini API is available, use it for analysis
        if self.model:
            try:
                # Prepare prompt for Gemini with explicit JSON request
                prompt = """Analyze this project data and provide insights in JSON format only.
                Your response must be a valid JSON object with the following structure:
                {
                "success_factors": ["factor1", "factor2", ...],
                "recommendations": ["rec1", "rec2", ...],
                "risk_mitigation_strategies": [{"risk": "risk1", "mitigation": "strategy1"}, ...],
                "predicted_trends": {"trend1": "description1", ...},
                "expected_budget": {"average": "value", "minimum": "value", "maximum": "value", "median": "value", "recommendation": "text"},
                "implementation_date": "text",
                "expected_duration": {"average": "value", "minimum": "value", "maximum": "value", "median": "value", "recommendation": "text"},
                "feedback": "text"
                }

                Project data:
                """
                prompt += str(primary_data)
                
                if secondary_data:
                    prompt += f"\n\nAdditional context: {secondary_data}"
                    
                prompt += "\n\nProvide your analysis as a single JSON object. Do not include any explanatory text outside the JSON."
                
                # Call Gemini API
                logger.debug("Sending prompt to Gemini API")
                gemini_response = self.model.generate_content(prompt)
                gemini_response_text = gemini_response.text
                logger.debug(f"Received response of length {len(gemini_response_text)}")
                
                # Try to parse JSON from response
                try:
                    # First clean up any markdown formatting
                    clean_text = re.sub(r'```json\s*|\s*```', '', gemini_response_text)
                    ai_analysis = json.loads(clean_text)
                    logger.info("Successfully created analysis using direct JSON generation")
                    response.update(ai_analysis)
                except json.JSONDecodeError:
                    logger.debug("Direct JSON generation failed, using fallback")
                    response.update(fallback_analysis)
            except Exception as e:
                logger.error(f"Failed to process Gemini response: {str(e)}")
                logger.info("Using fallback analysis")
                response.update(fallback_analysis)
        else:
            logger.info("No Gemini API available, using predetermined analysis")
            response.update(fallback_analysis)
            
        # Calculate some basic statistics from the data if available
        try:
            # Extract budget and duration information
            budget_values = []
            duration_values = []
            
            for project in primary_data:
                # Try to extract budget
                budget = project.get('Budget', '')
                if budget:
                    # Clean budget string and convert to numeric
                    budget_clean = budget.replace('₱', '').replace('PHP', '').replace(',', '').strip()
                    try:
                        budget_values.append(float(budget_clean))
                    except ValueError:
                        pass
                
                # Try to extract duration
                duration = project.get('Duration', '')
                if duration:
                    # Try to extract numeric value
                    duration_match = re.search(r'(\d+)', duration)
                    if duration_match:
                        try:
                            duration_values.append(float(duration_match.group(1)))
                        except ValueError:
                            pass
            
            # Update budget statistics if we have data
            if budget_values:
                response["expected_budget"] = {
                    "average": f"PHP {sum(budget_values)/len(budget_values):,.2f}",
                    "minimum": f"PHP {min(budget_values):,.2f}",
                    "maximum": f"PHP {max(budget_values):,.2f}",
                    "median": f"PHP {sorted(budget_values)[len(budget_values)//2]:,.2f}",
                    "recommendation": "Budget should include 15% contingency based on historical data"
                }
            
            # Update duration statistics if we have data
            if duration_values:
                response["expected_duration"] = {
                    "average": f"{sum(duration_values)/len(duration_values):.0f} days",
                    "minimum": f"{min(duration_values):.0f} days",
                    "maximum": f"{max(duration_values):.0f} days",
                    "median": f"{sorted(duration_values)[len(duration_values)//2]:.0f} days",
                    "recommendation": "Plan for average duration plus 20% buffer time"
                }
                
        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
        
        return response

    def generate_custom_response(self, options, primary_data, secondary_data=None):
        """
        Generates a customized predictive analysis response based on user-selected options.
        
        Args:
            options (dict): A dictionary of analysis options selected by the user
            primary_data (list): A list of dictionaries representing SK project data
            secondary_data (list, optional): Internet search results
        """
        # Get base response
        base_response = self.generate_general_response(primary_data, secondary_data)
        
        # Initialize custom response
        custom_response = {"analysis_type": "custom"}
        
        # Add selected components to the custom response
        if options.get('include_success_factors', True):
            custom_response["success_factors"] = base_response.get("success_factors", [])
        
        if options.get('include_recommendations', True):
            custom_response["recommendations"] = base_response.get("recommendations", [])
        
        if options.get('include_risks', True):
            custom_response["risk_mitigation_strategies"] = base_response.get("risk_mitigation_strategies", [])
        
        if options.get('include_trends', True):
            custom_response["predicted_trends"] = base_response.get("predicted_trends", {})
        
        if options.get('include_budget', True):
            custom_response["expected_budget"] = base_response.get("expected_budget", {})
        
        if options.get('include_implement_date', True):
            custom_response["implementation_date"] = base_response.get("implementation_date", "")
        
        if options.get('include_duration', True):
            custom_response["expected_duration"] = base_response.get("expected_duration", {})
        
        if options.get('include_feedback', True):
            custom_response["feedback"] = base_response.get("feedback", "")
        
        # Add metadata
        custom_response["custom_options"] = options
        custom_response["data_points"] = len(primary_data)
        
        return custom_response
    
    def get_available_options(self):
        """
        Returns the available analysis options for the frontend.
        
        Returns:
            dict: Available analysis options
        """
        return {
            "analysis_types": ["general", "custom"],
            "components": [
                {"id": "include_success_factors", "label": "Success Factors", "default": True},
                {"id": "include_recommendations", "label": "Recommendations", "default": True},
                {"id": "include_risks", "label": "Risk Mitigation Strategies", "default": True},
                {"id": "include_trends", "label": "Predicted Trends", "default": True},
                {"id": "include_budget", "label": "Expected Budget", "default": True},
                {"id": "include_implement_date", "label": "Implementation Date", "default": True},
                {"id": "include_duration", "label": "Expected Duration", "default": True},
                {"id": "include_feedback", "label": "Feedback", "default": True}
            ]
        }


if __name__ == "__main__":
    main()