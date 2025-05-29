import os
import json
import sys
from datetime import datetime, timedelta

# Detailed logging for numpy and pandas imports
try:
    import numpy as np
    print("INFO: Successfully imported numpy")
except ImportError as e:
    print(f"ERROR: Failed to import numpy: {str(e)}")
except Exception as e:
    print(f"ERROR: Unexpected error importing numpy: {str(e)}")

try:
    import pandas as pd
    print("INFO: Successfully imported pandas")
except ImportError as e:
    print(f"ERROR: Failed to import pandas: {str(e)}")
except Exception as e:
    print(f"ERROR: Unexpected error importing pandas: {str(e)}")

# Flag to track if Gemini is available
gemini_available = False

# Try importing matplotlib for plotting
try:
    import matplotlib.pyplot as plt
    import io
    import base64
    plotting_available = True
    print("INFO: Successfully imported matplotlib and plotting libraries")
except ImportError as e:
    print(f"ERROR: Failed to import matplotlib: {str(e)}")
    plotting_available = False
except Exception as e:
    print(f"ERROR: Unexpected error importing matplotlib: {str(e)}")
    plotting_available = False

# Try importing Gemini with detailed error handling
try:
    print("INFO: Attempting to import Gemini API...")
    import google.generativeai as genai
    print("INFO: Successfully imported google.generativeai")
    
    try:
        from dotenv import load_dotenv
        print("INFO: Successfully imported dotenv")
        
        # Accessing dotenv file for API keys
        dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        print(f"INFO: Loading .env from: {dotenv_path}")
        load_dotenv(dotenv_path=dotenv_path)
        
        # Configure Google Gemini API
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        if GEMINI_API_KEY:
            print("INFO: GEMINI_API_KEY found in environment")
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel('gemini-2.0-flash')
                text_model = genai.GenerativeModel('gemini-2.0-flash')
                gemini_available = True
                print("INFO: Gemini API configured successfully")
            except Exception as config_err:
                print(f"ERROR: Failed to configure Gemini API: {str(config_err)}")
                gemini_available = False
        else:
            print("ERROR: GEMINI_API_KEY not found in environment variables")
            gemini_available = False
    except ImportError as dotenv_err:
        print(f"ERROR: Failed to import dotenv: {str(dotenv_err)}")
        gemini_available = False
    except Exception as e:
        print(f"ERROR: Unexpected error setting up dotenv: {str(e)}")
        gemini_available = False
except ImportError as genai_err:
    print(f"ERROR: Failed to import google.generativeai: {str(genai_err)}")
    gemini_available = False
except Exception as e:
    print(f"ERROR: Unexpected error importing Gemini: {str(e)}")
    gemini_available = False

# Try importing regex
try:
    import re
    print("INFO: Successfully imported re (regex)")
except ImportError as e:
    print(f"ERROR: Failed to import re (regex): {str(e)}")
except Exception as e:
    print(f"ERROR: Unexpected error importing re (regex): {str(e)}")

print(f"INFO: Module initialization complete. Gemini available: {gemini_available}, Plotting available: {plotting_available}")

def plot_forecast_for_gemini(forecast_data):
    """
    Generate a plot of the forecast data to send to Gemini
    
    Args:
        forecast_data: Dictionary containing ds, yhat, yhat_lower, yhat_upper
        
    Returns:
        Base64 encoded image or None if plotting not available
    """
    if not plotting_available:
        print("INFO: Plotting not available, skipping plot generation")
        return None
        
    try:
        plt.figure(figsize=(12, 6))
        
        # Convert dates if they're strings
        dates = forecast_data['ds']
        if isinstance(dates[0], str):
            dates = [datetime.strptime(date, '%Y-%m-%d') for date in dates]
        
        # Plot the forecast values
        plt.plot(dates, forecast_data['yhat'], label='Forecast', color='blue')
        
        # Plot the upper and lower bounds if available
        if 'yhat_lower' in forecast_data and 'yhat_upper' in forecast_data:
            plt.fill_between(dates, 
                            forecast_data['yhat_lower'], 
                            forecast_data['yhat_upper'], 
                            color='blue', alpha=0.2, label='Prediction Interval')
        
        # Add historical data points if available
        if 'historical_acceptance' in forecast_data and forecast_data['historical_acceptance']:
            historical_data = forecast_data['historical_acceptance']
            hist_dates = [item.get('ds') for item in historical_data]
            hist_values = [item.get('y') for item in historical_data]
            
            if hist_dates and hist_values:
                if isinstance(hist_dates[0], str):
                    hist_dates = [datetime.strptime(date, '%Y-%m-%d') for date in hist_dates]
                plt.scatter(hist_dates, hist_values, color='red', label='Historical Data')
        
        # Add labels and title
        plt.title('Project Volume Forecast')
        plt.xlabel('Date')
        plt.ylabel('Number of Projects')
        plt.legend()
        plt.grid(True, linestyle='--', alpha=0.7)
        
        # Format x-axis to avoid overcrowding
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        # Instead of saving to file, save to bytes buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        
        # Convert to base64 for API transmission
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close()
        
        return img_base64
        
    except Exception as e:
        print(f"INFO: Forecast plot generation skipped: {str(e)}")
        return None

def generate_fallback_response(error_message="Unable to generate forecast analysis. The AI model could not process the request."):
    """Generate a basic analysis when Gemini is not available"""
    
    # Basic analysis based on statistical patterns - will work without Gemini
    basic_analysis = {
        "summary": "Forecast analysis based on historical data patterns. For detailed AI-powered analysis, please ensure the Gemini API is properly configured.",
        "trends": [
            {
                "title": "Seasonal Patterns",
                "description": "The forecast may show seasonal patterns that align with historical project submission trends.",
                "type": "info"
            },
            {
                "title": "Project Growth",
                "description": "The forecast indicates potential growth in project submissions based on historical data patterns.",
                "type": "positive"
            }
        ],
        "recommendations": [
            "Monitor actual project submissions against the forecast to validate accuracy",
            "Consider resource allocation based on predicted project volume patterns",
            "Prepare for potential seasonal variations in project submissions"
        ],
        "confidence": 0.6,
        "source": "System Fallback Analysis",
        "gemini_powered": False
    }
    
    if error_message:
        basic_analysis["error"] = True
        basic_analysis["message"] = error_message
    
    return basic_analysis

def generate_forecast_response(forecast_data, filters=None):
    """
    Generate a natural language analysis of Prophet forecast data
    
    Args:
        forecast_data: Dictionary containing the forecast data from Prophet
        filters: Dictionary containing any filters applied to the data
        
    Returns:
        Dictionary containing analysis or error information
    """
    try:
        # Check if forecast data is valid
        if not forecast_data or 'ds' not in forecast_data or not forecast_data['ds']:
            print("INFO: Invalid forecast data provided")
            return generate_fallback_response("Invalid forecast data provided. Missing required time series data.")
        
        # If Gemini is not available, return fallback analysis
        if not gemini_available:
            print("INFO: Gemini API not available, returning basic analysis")
            return generate_fallback_response("AI-powered analysis unavailable. Gemini API not configured.")
            
        # Try to generate analysis with Gemini
        try:
            # Plot the forecast data for Gemini to analyze
            print("INFO: Plotting forecast data for AI analysis...")
            image_base64 = plot_forecast_for_gemini(forecast_data)
            
            if image_base64:
                # Create text prompt for Gemini with context about the forecast
                print("INFO: Creating prompt for AI analysis...")
                prompt = create_prompt_for_forecast(forecast_data, filters)
                
                # Generate content using Gemini Vision model
                print("INFO: Generating AI analysis with image and text...")
                response = model.generate_content([prompt, {"mime_type": "image/png", "data": image_base64}])
                
                # Extract and process response
                return process_gemini_response(response.text)
            else:
                # Fall back to text-only analysis if plotting fails
                print("INFO: Using text-only analysis due to plot generation failure...")
                text_prompt = create_text_prompt_from_data(forecast_data, filters)
                response = text_model.generate_content(text_prompt)
                return process_gemini_response(response.text)
                
        except Exception as e:
            print(f"ERROR: Failed to generate analysis with Gemini: {str(e)}")
            return generate_fallback_response(f"Error generating AI analysis: {str(e)[:100]}")
            
    except Exception as e:
        print(f"ERROR: Forecast response generation failed: {str(e)}")
        return generate_fallback_response(f"Error in forecast analysis: {str(e)[:100]}")

def create_prompt_for_forecast(forecast_data, filters=None):
    """Create a prompt for Gemini to analyze forecast data"""
    if not gemini_available:
        return ""
        
    prompt = """
    You are an expert data scientist specializing in time series forecasting for project planning systems.
    
    Analyze the forecast graph showing predicted project volumes over time. The forecast is generated using Facebook's Prophet algorithm.
    
    Based on the data visualization:
    
    1. Provide a concise summary of the overall forecast trend (increasing, decreasing, stable, or fluctuating)
    2. Identify and explain 2-3 key patterns or insights (seasonality, unusual spikes or dips, etc.)
    3. Suggest 2-3 practical recommendations for planning based on the forecast
    4. Rate your confidence in the forecast (Low, Medium, High) and explain why
    
    Your response will be displayed directly to non-technical users, so use clear, simple language.
    Format your response as a JSON object with the following structure:
    {
      "summary": "One paragraph summary of the forecast trend",
      "trends": [
        {"title": "Name of trend 1", "description": "Description of trend 1", "type": "positive/negative/info"},
        {"title": "Name of trend 2", "description": "Description of trend 2", "type": "positive/negative/info"}
      ],
      "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
      "confidence": 0.XX (decimal between 0-1 representing confidence level)
    }
    """
    
    # Add specific filter context if available
    if filters:
        prompt += "\n\nAdditional context:"
        
        if filters.get('category') and filters.get('category') != 'all':
            prompt += f"\n- This forecast is filtered to show only {filters.get('category')} projects"
        
        if filters.get('budget') and filters.get('budget') != 'all':
            budget_range = filters.get('budget')
            prompt += f"\n- Budget range filter: {budget_range}"
        
        if filters.get('startDate'):
            prompt += f"\n- Start date filter: {filters.get('startDate')}"
            
        if filters.get('endDate'):
            prompt += f"\n- End date filter: {filters.get('endDate')}"
    
    return prompt

def create_text_prompt_from_data(forecast_data, filters=None):
    """Create a text-only prompt if image analysis is not available"""
    if not gemini_available:
        return ""
        
    prompt = "Analyze the following forecast data:\n\n"
    
    # Add date ranges
    if forecast_data.get('ds'):
        start_date = forecast_data['ds'][0]
        end_date = forecast_data['ds'][-1]
        prompt += f"Date range: {start_date} to {end_date}\n"
    
    # Add forecast values summary
    if forecast_data.get('yhat'):
        avg_forecast = sum(forecast_data['yhat']) / len(forecast_data['yhat'])
        min_forecast = min(forecast_data['yhat'])
        max_forecast = max(forecast_data['yhat'])
        
        prompt += f"Average forecast value: {avg_forecast:.2f}\n"
        prompt += f"Minimum forecast value: {min_forecast:.2f}\n"
        prompt += f"Maximum forecast value: {max_forecast:.2f}\n"
        
        # Detect trend
        first_half_avg = sum(forecast_data['yhat'][:len(forecast_data['yhat'])//2]) / (len(forecast_data['yhat'])//2)
        second_half_avg = sum(forecast_data['yhat'][len(forecast_data['yhat'])//2:]) / (len(forecast_data['yhat']) - len(forecast_data['yhat'])//2)
        
        if second_half_avg > first_half_avg * 1.05:
            prompt += "Overall trend: Increasing\n"
        elif first_half_avg > second_half_avg * 1.05:
            prompt += "Overall trend: Decreasing\n"
        else:
            prompt += "Overall trend: Stable\n"
    
    # Add filter information
    if filters:
        prompt += "\nFilters applied:\n"
        for key, value in filters.items():
            if value and value != 'all':
                prompt += f"- {key}: {value}\n"
    
    # Request format
    prompt += """
    Based on this data, provide analysis in the following JSON format:
    {
      "summary": "One paragraph summary of the forecast trend",
      "trends": [
        {"title": "Name of trend 1", "description": "Description of trend 1", "type": "positive/negative/info"},
        {"title": "Name of trend 2", "description": "Description of trend 2", "type": "positive/negative/info"}
      ],
      "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
      "confidence": 0.XX (decimal between 0-1 representing confidence level)
    }
    """
    
    return prompt

def process_gemini_response(response_text):
    """Process and extract JSON from Gemini's response"""
    if not gemini_available:
        return generate_fallback_response()
        
    try:
        # Try to extract JSON from the response
        json_match = re.search(r'({[\s\S]*})', response_text)
        if json_match:
            json_str = json_match.group(1)
            
            # Clean the JSON string before parsing
            json_str = (json_str
                .replace("\\'", "'")
                .replace('\\"', '"')
                .replace('\\n', ' ')
                .replace('\\t', ' ')
                .replace('\\r', '')
            )
            
            # Parse the JSON
            data = json.loads(json_str)
            
            # Sanitize the structure and add source info
            sanitized = sanitize_analysis(data)
            sanitized['source'] = "Gemini AI Analysis"
            sanitized['gemini_powered'] = True
            return sanitized
        else:
            print("INFO: Unable to extract JSON from Gemini response")
            return generate_fallback_response("Unable to extract valid JSON data from Gemini response")
            
    except Exception as e:
        print(f"ERROR: Error processing Gemini response: {str(e)}")
        return generate_fallback_response(f"Error processing Gemini response: {str(e)[:100]}")

def sanitize_analysis(analysis):
    """Sanitize and validate the analysis structure"""
    # Create a new analysis object with proper structure
    result = {}
    
    # Ensure summary is a string
    if 'summary' in analysis and isinstance(analysis['summary'], str):
        result['summary'] = analysis['summary']
    else:
        result['summary'] = "Forecast analysis based on available data"
    
    # Ensure trends is a list of properly formatted objects
    result['trends'] = []
    if 'trends' in analysis and isinstance(analysis['trends'], list):
        for trend in analysis['trends']:
            if isinstance(trend, dict):
                sanitized_trend = {
                    'title': str(trend.get('title', 'Trend Analysis')),
                    'description': str(trend.get('description', 'Analysis of forecast patterns')),
                    'type': str(trend.get('type', 'info'))
                }
                result['trends'].append(sanitized_trend)
    
    # Add default trend if empty
    if not result['trends']:
        result['trends'] = [
            {
                "title": "Forecast Analysis",
                "description": "Analysis based on the forecast data",
                "type": "info"
            }
        ]
    
    # Ensure recommendations is a list of strings
    result['recommendations'] = []
    if 'recommendations' in analysis and isinstance(analysis['recommendations'], list):
        for rec in analysis['recommendations']:
            result['recommendations'].append(str(rec))
    
    # Add default recommendation if empty
    if not result['recommendations']:
        result['recommendations'] = ["Plan resources according to forecast data"]
    
    # Ensure confidence is a float
    if 'confidence' in analysis and isinstance(analysis['confidence'], (float, int)):
        result['confidence'] = float(analysis['confidence'])
    else:
        result['confidence'] = 0.7
    
    # Add source information
    result['source'] = "Gemini AI Analysis"
    result['gemini_powered'] = True
    
    return result

# For testing via command line
if __name__ == "__main__":
    import sys
    
    try:
        # Try to import the forecast module
        try:
            import forecast
            forecast_module_available = True
        except ImportError:
            print("INFO: Cannot import forecast module for testing")
            forecast_module_available = False
        
        # Get sample forecast data
        print("INFO: Getting sample forecast data...")
        if forecast_module_available:
            sample_forecast = forecast.generate_sample_forecast_json()
        else:
            # Create basic sample data if forecast module isn't available
            current_date = datetime.now()
            dates = [(current_date + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(30)]
            values = [10 + i*0.1 + np.random.normal(0, 1) for i in range(30)]
            upper = [v + 2 for v in values]
            lower = [v - 2 for v in values]
            
            sample_forecast = {
                "ds": dates,
                "yhat": values,
                "yhat_upper": upper,
                "yhat_lower": lower
            }
        
        # Generate analysis
        print("INFO: Generating forecast analysis...")
        analysis = generate_forecast_response(sample_forecast)
        
        # Output the analysis completion message
        print("INFO: Analysis generation complete")
        
        # Use print instead of sys.stdout.write for JSON output
        print(json.dumps(analysis, indent=None))
    except Exception as e:
        print(f"ERROR: Error in main: {str(e)}")
        fallback = generate_fallback_response(f"Error generating analysis: {str(e)}")
        print(json.dumps(fallback, indent=None))
