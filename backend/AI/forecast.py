import os
import json
import pandas as pd
import numpy as np
from prophet import Prophet
import sys
import argparse
from datetime import datetime, timedelta

# Import Google API libraries
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    google_api_available = True
except ImportError:
    google_api_available = False

# Import plotly 
try:
    import plotly
    plotly_available = True
except ImportError:
    print("INFO: Plotly not available, interactive plots disabled")
    plotly_available = False

# Accessing dotenv file
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=dotenv_path)
    SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
except ImportError:
    SPREADSHEET_ID = None

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SAMPLE_RANGE_NAME = 'Data100!A:G'

# Budget range mappings
BUDGET_RANGES = {
    'range1': (105600, 130000),  
    'range2': (81200, 105599),   
    'range3': (56800, 81199),   
    'range4': (32400, 56799),   
    'range5': (8000, 32399)     
}

def get_sheet_data():
    """Retrieve project data from Google Sheets"""
    try:
        from googleapiclient.discovery import build
        from google_auth_oauthlib.flow import InstalledAppFlow
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
    except ImportError:
        print("INFO: Google API libraries not available, using sample data")
        return generate_sample_data()
    
    creds = None
    credentials_path = os.path.join(os.path.dirname(__file__), 'credentials.json')
    token_path = os.path.join(os.path.dirname(__file__), 'token.json')
    
    if os.path.exists(token_path):
        try:
            creds = Credentials.from_authorized_user_info(json.loads(open(token_path).read()))
        except Exception as e:
            print(f"ERROR: Credentials refresh failed: {str(e)[:50]}...")
            return generate_sample_data()
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"ERROR: Credentials refresh failed: {str(e)[:50]}...")
                return generate_sample_data()
        else:
            if not os.path.exists(credentials_path):
                print(f"INFO: Using sample data, credentials file not found at {credentials_path}")
                return generate_sample_data()
            
            try:
                flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            except Exception as e:
                print(f"ERROR: Authentication failed: {str(e)[:50]}...")
                return generate_sample_data()

    try:
        service = build('sheets', 'v4', credentials=creds)
        sheet = service.spreadsheets()
        result = sheet.values().get(spreadsheetId=SPREADSHEET_ID,
                                     range=SAMPLE_RANGE_NAME).execute()
        values = result.get('values', [])
        if not values:
            print("INFO: No data found in sheet, using sample data")
            return generate_sample_data()
        return values
    except Exception as err:
        if isinstance(err, HttpError):
            print(f"ERROR: Google Sheets API error: {str(err)[:50]}...")
        else:
            print(f"ERROR: Data retrieval failed: {str(err)[:50]}...")
        return generate_sample_data()

def get_spreadsheet_title():
    """Retrieve the title of the spreadsheet being used for data analysis"""
    if not google_api_available or not SPREADSHEET_ID:
        return "Sample SK Project Database"
        
    try:
        creds = None
        token_path = os.path.join(os.path.dirname(__file__), 'token.json')
        
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_info(json.loads(open(token_path).read()))
            
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                except Exception:
                    return "SK Project Database"
            else:
                return "SK Project Database"
                
        service = build('sheets', 'v4', credentials=creds)
        spreadsheet = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        return spreadsheet.get('properties', {}).get('title', 'SK Project Database')
    except Exception as e:
        print(f"INFO: Could not retrieve spreadsheet title: {str(e)[:50]}...")
        return "SK Project Database"

def get_sheet_name():
    """Retrieve the name of the sheet being used for data analysis"""
    # Extract sheet name from SAMPLE_RANGE_NAME
    sheet_name = SAMPLE_RANGE_NAME.split('!')[0] if '!' in SAMPLE_RANGE_NAME else "Data"
    return sheet_name

def generate_sample_data():
    """Generate sample data for demonstration when real data is unavailable"""
    header = ['Project Name', 'Category', 'Budget', 'Start Date', 'Duration', 'Sub Category', 'Status']
    
    # Create sample project data
    projects = []
    projects.append(header)
    
    # Categories
    categories = {
        'training',
        'sportsEvents',
        'feedingProgram',
        'scholarships',
        'artsCulture',
        'other'
    }
    
    # Generate 30 sample projects with realistic data
    today = datetime.now()
    
    for i in range(30):
        category = np.random.choice(list(categories.keys()))
        sub_category = np.random.choice(categories[category])

        days_ago = np.random.randint(0, 730)
        start_date = (today - timedelta(days=days_ago)).strftime('%Y-%m-%d')

        budget = np.random.randint(8000, 130000)

        duration_days = np.random.choice([1, np.random.randint(2, 7), np.random.randint(7, 30), 
                                         np.random.randint(30, 180), np.random.randint(180, 365)])

        status = np.random.choice(["Completed", "In Progress", "Planning", "On Hold"])
        
        # Project name based on category
        project_name = f"{category.capitalize()} Project {i+1}"
        
        projects.append([project_name, category, str(budget), start_date, str(duration_days), sub_category, status])
    
    return projects

def parse_filter_options(options):
    """Parse filter options from the request"""
    filters = {
        'category': options.get('category', 'all'),
        'budget': options.get('budget', 'all'),
        'startDate': options.get('startDate', None),
        'endDate': options.get('endDate', None)
    }
    return filters

def apply_filters(data, filters):
    """Apply filters to the data"""
    if not data or len(data) <= 1:
        return data
    
    header = data[0]
    filtered_data = [header]
    
    # Find column indices
    col_indices = {}
    for i, col_name in enumerate(header):
        col_name_lower = col_name.lower()
        if 'project' in col_name_lower and 'name' in col_name_lower:
            col_indices['project_name'] = i
        elif 'category' in col_name_lower and 'sub' not in col_name_lower:
            col_indices['category'] = i
        elif 'budget' in col_name_lower:
            col_indices['budget'] = i
        elif 'start' in col_name_lower and 'date' in col_name_lower:
            col_indices['start_date'] = i
        elif 'duration' in col_name_lower:
            col_indices['duration'] = i
        elif 'description' in col_name_lower:
            col_indices['description'] = i
    
    # Apply filters to each row
    for row in data[1:]:
        include_row = True

        if len(row) <= max(col_indices.values()):
            continue
        
        # Category filter
        if filters['category'] != 'all' and 'category' in col_indices:
            category_value = row[col_indices['category']].lower()
            filter_category = filters['category'].lower()

            if filter_category not in category_value:

                if filter_category == 'artsculture' and ('arts' in category_value and 'culture' in category_value):
                    pass  
                elif filter_category == 'sportsevents' and ('sports' in category_value and 'events' in category_value):
                    pass  
                elif filter_category == 'feedingprogram' and ('feeding' in category_value and 'program' in category_value):
                    pass  
                    include_row = False
        
        # Budget filter
        if filters['budget'] != 'all' and 'budget' in col_indices:
            try:
                budget_value = float(row[col_indices['budget']].replace(',', '').replace('₱', ''))
                budget_range = BUDGET_RANGES.get(filters['budget'])
                if budget_range and (budget_value < budget_range[0] or budget_value > budget_range[1]):
                    include_row = False
            except (ValueError, TypeError):
                include_row = False
        
        # Date range filter
        if (filters['startDate'] or filters['endDate']) and 'start_date' in col_indices:
            try:
                row_date = datetime.strptime(row[col_indices['start_date']], '%Y-%m-%d')
                
                if filters['startDate']:
                    start_date = datetime.strptime(filters['startDate'], '%Y-%m-%d')
                    if row_date < start_date:
                        include_row = False
                
                if filters['endDate']:
                    end_date = datetime.strptime(filters['endDate'], '%Y-%m-%d')
                    if row_date > end_date:
                        include_row = False
            except (ValueError, TypeError):
                pass  
        
        if include_row:
            filtered_data.append(row)
    
    return filtered_data

def generate_sample_forecast_json(filters=None, error_message="No valid forecast data available"):
    """Return an error message instead of generating sample forecast data"""
    return json.dumps({
        "error": True,
        "message": error_message,
        "ds": [],
        "yhat": [],
        "yhat_upper": [],
        "yhat_lower": []
    })

def run_forecast(options=None):
    """Run the Prophet forecast with optional filters and return the results as JSON"""
    # Get data from sheet
    sheet_values = get_sheet_data()
    
    # Parse filter options
    filters = parse_filter_options(options or {})
    
    # category-specific scaling factors
    category_scaling = {
        'training': 0.54,
        'sportsEvents': 0.168,
        'feedingProgram': 0.16,
        'scholarships': 0.09,
        'artsCulture': 0.11,
        'other': 0.02
    }

    scaling_factor = 0.3 
    
    # Apply category-specific scaling if a category is selected
    if filters['category'] != 'all':
        scaling_factor = category_scaling.get(filters['category'], 0.2)
    
    # Apply filters if any are set
    if any(v != 'all' for v in [filters['category'], filters['budget']]) or \
       filters['startDate'] or filters['endDate']:
        sheet_values = apply_filters(sheet_values, filters)
    
    if not sheet_values or len(sheet_values) <= 1: 
        print("INFO: No valid data available for forecasting after applying filters")
        return generate_sample_forecast_json(filters, "No valid data available for forecasting after applying filters")
    
    header = sheet_values[0]
    project_name_col_index = -1
    start_date_col_index = -1

    try:
        # Find the column indices
        for i, col_name in enumerate(header):
            col_name_lower = col_name.lower()
            if 'project' in col_name_lower and 'name' in col_name_lower:
                project_name_col_index = i
            elif 'start' in col_name_lower and 'date' in col_name_lower:
                start_date_col_index = i
        
        if project_name_col_index == -1 or start_date_col_index == -1:
            raise ValueError("Required columns not found in data")
        
        project_data = []
        
        for row in sheet_values[1:]:
            try:
                if len(row) > max(project_name_col_index, start_date_col_index):
                    project_name = row[project_name_col_index]
                    start_date_str = row[start_date_col_index]
                    
                    # Add to general project count
                    project_data.append({'ds': start_date_str, 'y': 1})
            except IndexError:
                continue 
        
        if not project_data:
            raise ValueError("No valid project data found")
        
        # Convert to DataFrame for prophet
        df = pd.DataFrame(project_data)
        df['ds'] = pd.to_datetime(df['ds'])
        df = df.groupby('ds').count().reset_index()
        df.columns = ['ds', 'y']
        
        # Run Prophet forecast
        m = Prophet()
        m.fit(df)
        
        # Determine forecast period based on filters
        forecast_period = 365 
        if filters['startDate'] and filters['endDate']:
            try:
                start_date = datetime.strptime(filters['startDate'], '%Y-%m-%d')
                end_date = datetime.strptime(filters['endDate'], '%Y-%m-%d')
                forecast_period = (end_date - start_date).days + 1
            except (ValueError, TypeError):
                pass
        
        future = m.make_future_dataframe(periods=forecast_period, freq='D')
        
        # Apply date range filter
        if filters['startDate']:
            try:
                start_date = datetime.strptime(filters['startDate'], '%Y-%m-%d')
                future = future[future['ds'] >= pd.Timestamp(start_date)]
            except (ValueError, TypeError):
                pass
        
        if filters['endDate']:
            try:
                end_date = datetime.strptime(filters['endDate'], '%Y-%m-%d')
                future = future[future['ds'] <= pd.Timestamp(end_date)]
            except (ValueError, TypeError):
                pass
        
        forecast = m.predict(future)
        
        # Forecast data to JSON
        forecast_dates = forecast['ds'].dt.strftime('%Y-%m-%d').tolist()
        
        # Apply scaling
        forecast_values = (forecast['yhat'] * scaling_factor).round(2).tolist()
        forecast_upper = (forecast['yhat_upper'] * scaling_factor).round(2).tolist()
        forecast_lower = (forecast['yhat_lower'] * scaling_factor).round(2).tolist()
        
        # Return the forecast data as JSON
        return json.dumps({
            "ds": forecast_dates,
            "yhat": forecast_values,
            "yhat_upper": forecast_upper,
            "yhat_lower": forecast_lower
        })
        
    except Exception as e:
        print(f"ERROR: Forecast generation failed: {str(e)[:50]}...")
        return generate_sample_forecast_json(filters, f"Error in forecast processing: {str(e)[:50]}...")

def generate_forecast_with_analysis(options=None):
    """
    Run the forecast and generate both data and natural language analysis
    
    Args:
        options: Dictionary of filter options
        
    Returns:
        Dictionary containing forecast data and analysis or error information
    """
    try:
        # Get the forecast data
        forecast_json = run_forecast(options)
        
        # Parse forecast data if it's a string
        try:
            if isinstance(forecast_json, str):
                forecast_data = json.loads(forecast_json)
            else:
                forecast_data = forecast_json
                
            # Check if there's an error in the forecast data
            if forecast_data.get('error'):
                return {
                    "error": True,
                    "message": forecast_data.get('message', "Error generating forecast data"),
                    "forecast_data": forecast_data
                }
                
        except json.JSONDecodeError as e:
            print(f"ERROR: Forecast parsing failed: {str(e)[:50]}...")
            return {
                "error": True,
                "message": f"Error parsing forecast data: {str(e)[:50]}...",
                "forecast_data": {}
            }
        
        # Import the response module with better error handling and detailed debugging
        try:
            print("INFO: Attempting to import fcResponse module...")
            import sys
            print(f"INFO: Python search paths: {sys.path}")
            print(f"INFO: Current directory: {os.getcwd()}")
            
            try:
                # Attempt absolute import
                print("INFO: Trying absolute import...")
                import fcResponse
                print("INFO: Successfully imported fcResponse module via absolute import")
                fcResponse_available = True
            except ImportError as absolute_import_err:
                print(f"INFO: Absolute import failed: {str(absolute_import_err)}")
                
                try:
                    # Attempt relative import
                    print("INFO: Trying relative import...")
                    from . import fcResponse
                    print("INFO: Successfully imported fcResponse module via relative import")
                    fcResponse_available = True
                except ImportError as relative_import_err:
                    print(f"ERROR: Relative import also failed: {str(relative_import_err)}")
                    
                    # Check if file exists
                    fcresponse_path = os.path.join(os.path.dirname(__file__), 'fcResponse.py')
                    if os.path.exists(fcresponse_path):
                        print(f"INFO: fcResponse.py file exists at {fcresponse_path}")
                    else:
                        print(f"ERROR: fcResponse.py file does not exist at {fcresponse_path}")
                    
                    fcResponse_available = False
                except Exception as other_relative_err:
                    print(f"ERROR: Other error in relative import: {str(other_relative_err)}")
                    fcResponse_available = False
            except Exception as other_absolute_err:
                print(f"ERROR: Other error in absolute import: {str(other_absolute_err)}")
                fcResponse_available = False
            
            if fcResponse_available:
                try:
                    # Generate the analysis
                    print("INFO: Generating AI analysis of forecast data...")
                    analysis = fcResponse.generate_forecast_response(forecast_data, options)
                    
                    # Check if analysis contains an error flag
                    if isinstance(analysis, dict) and analysis.get('error'):
                        return {
                            "error": True,
                            "message": analysis.get('message', "Error generating analysis"),
                            "forecast_data": forecast_data,
                            "analysis": {
                                "summary": analysis.get('summary', "Unable to generate analysis"),
                                "trends": [],
                                "recommendations": [],
                                "confidence": 0
                            }
                        }
                    
                    # Combine the forecast data with the analysis
                    result = {
                        "forecast_data": forecast_data,
                        "analysis": analysis,
                        "gemini_powered": fcResponse_available and hasattr(fcResponse, 'gemini_available') and fcResponse.gemini_available
                    }
                    
                    return result
                except Exception as e:
                    print(f"ERROR: Analysis generation failed: {str(e)}")
                    return {
                        "error": True,
                        "message": f"Error generating analysis: {str(e)[:100]}",
                        "forecast_data": forecast_data,
                        "analysis": {
                            "summary": "Unable to generate forecast analysis at this time.",
                            "trends": [],
                            "recommendations": [],
                            "confidence": 0
                        }
                    }
        except ImportError as e:
            print(f"ERROR: fcResponse module not available: {str(e)}")
            return {
                "error": True,
                "message": f"Analysis module is not available: {str(e)[:100]}",
                "forecast_data": forecast_data,
                "analysis": {
                    "summary": "Unable to generate forecast analysis - analysis module not available.",
                    "trends": [],
                    "recommendations": [],
                    "confidence": 0,
                    "source": "Error Response",
                    "gemini_powered": False
                },
                "gemini_powered": False,
                "debug_info": {
                    "python_path": sys.path,
                    "current_dir": os.getcwd(),
                    "module_error": str(e)
                }
            }
    except Exception as e:
        print(f"ERROR: Forecast/analysis generation failed: {str(e)[:50]}...")
        return {
            "error": True,
            "message": f"Error generating forecast with analysis: {str(e)[:50]}...",
            "forecast_data": {},
            "analysis": {
                "summary": "Unable to generate forecast analysis due to system error.",
                "trends": [],
                "recommendations": [],
                "confidence": 0
            }
        }

# For testing and handling command-line arguments
if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Generate forecast')
    parser.add_argument('--days', type=int, default=30, help='Number of days to forecast')
    parser.add_argument('--no-history', action='store_true', help='Exclude historical data from response')
    parser.add_argument('--category', type=str, help='Filter by project category')
    parser.add_argument('--budget', type=str, help='Filter by budget range')
    parser.add_argument('--startDate', type=str, help='Filter by start date (YYYY-MM-DD)')
    parser.add_argument('--endDate', type=str, help='Filter by end date (YYYY-MM-DD)')
    parser.add_argument('--analysis', action='store_true', help='Include AI analysis of forecast')
    
    args = parser.parse_args()
    
    # Prepare filters from arguments
    filters = {}
    if args.category:
        filters['category'] = args.category
    if args.budget:
        filters['budget'] = args.budget
    if args.startDate:
        filters['startDate'] = args.startDate
    if args.endDate:
        filters['endDate'] = args.endDate
    
    try:
        if args.analysis:
            print("INFO: Generating forecast with analysis...")
            result = generate_forecast_with_analysis(options=filters)
            print("INFO: Forecast with analysis complete")
            # Use print instead of sys.stdout.write for JSON output
            print(json.dumps(result, ensure_ascii=False, separators=(',', ':'), indent=None))
        else:
            print("INFO: Generating standard forecast...")
            result = run_forecast(options=filters)
            print("INFO: Standard forecast complete")
            # Use print instead of sys.stdout.write for JSON output
            print(result)
    except Exception as e:
        print("INFO: Returning error response")
        # Use print instead of sys.stdout.write for JSON output
        print(json.dumps({
            "error": True,
            "message": f"Failed to generate forecast: {str(e)[:100]}"
        }, ensure_ascii=False, separators=(',', ':'), indent=None))