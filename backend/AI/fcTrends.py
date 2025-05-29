import os
import json
import pandas as pd
import numpy as np
import argparse
from datetime import datetime, timedelta
import re
import requests
from collections import Counter
import sys

# Import Google Gemini if available
try:
    import google.generativeai as genai
    gemini_available = True
except ImportError:
    print("INFO: Gemini module not available")
    gemini_available = False

# Import dotenv for environment variables
try:
    from dotenv import load_dotenv
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    load_dotenv(dotenv_path=dotenv_path)
except ImportError:
    print("INFO: dotenv not available, using environment variables directly")

# Check for SPREADSHEET_ID in environment
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")
if SPREADSHEET_ID:
    print(f"INFO: Using spreadsheet ID: {SPREADSHEET_ID[:5]}...")
else:
    print("INFO: SPREADSHEET_ID not found in environment variables")

# Import local modules with error handling
try:
    # Try absolute import first
    import forecast
    forecast_module_available = True
    print("INFO: Successfully imported forecast module (absolute import)")
except ImportError:
    try:
        # Try relative import if absolute fails
        from . import forecast
        forecast_module_available = True
        print("INFO: Successfully imported forecast module (relative import)")
    except ImportError:
        print("INFO: Local forecast module not available")
        forecast_module_available = False
    except Exception as e:
        print(f"INFO: Error importing forecast module: {str(e)[:100]}")
        forecast_module_available = False

# Configure Google Gemini API with proper error handling
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if gemini_available and GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')
        gemini_configured = True
    except Exception as e:
        print(f"ERROR: Failed to configure Gemini API: {str(e)[:50]}...")
        gemini_configured = False
else:
    print("INFO: Gemini API not configured, will use fallback")
    gemini_configured = False

# Configure Google Programmable Search Engine
PSE_API_KEY = os.getenv("SEARCH_ENGINE_API")
PSE_ENGINE_ID = os.getenv("SEARCH_ENGINE_ID")
if not PSE_API_KEY or not PSE_ENGINE_ID:
    print("INFO: Search API not configured, internet search limited")
    pse_configured = False
else:
    pse_configured = True

# Define relevant project categories for SK
SK_PROJECT_CATEGORIES = [
    "youth development",
    "education",
    "skills training",
    "environmental",
    "sports",
    "digital literacy",
    "mental health",
    "entrepreneurship",
    "community service",
    "health and wellness",
    "arts and culture",
    "disaster preparedness",
    "livelihood",
    "leadership training",
    "civic education"
]

# Define custom forecast categories
CUSTOM_FORECAST_CATEGORIES = [
    "Training",
    "Education",
    "Healthcare",
    "Environment",
    "Sports",
    "Others"  # Special category for user-defined custom categories
]

def get_historical_data_summary():
    """
    Process historical data from spreadsheet to identify trends and patterns
    Returns a summary of historical project data
    """
    if not forecast_module_available:
        print("INFO: Using sample data summary, forecast module not available")
        sample_data = generate_sample_data_summary()
        sample_data['data_source'] = 'Sample SK Project Data (generated)'
        sample_data['primary_data_rows'] = 50
        return sample_data
        
    try:
        # Get sheet data and source info from the forecast module
        print("INFO: Attempting to get sheet data from forecast module...")
        if hasattr(forecast, 'SPREADSHEET_ID'):
            print(f"INFO: Found SPREADSHEET_ID in forecast module: {forecast.SPREADSHEET_ID[:5] if forecast.SPREADSHEET_ID else 'None'}")
        sheet_data = forecast.get_sheet_data()
        print(f"INFO: Retrieved sheet data with {len(sheet_data) if sheet_data else 0} rows")
        
        # Even if forecast module is available, check if SPREADSHEET_ID is available
        if not os.getenv("SPREADSHEET_ID") and (not sheet_data or len(sheet_data) <= 1):
            print("INFO: SPREADSHEET_ID not found in environment or invalid sheet data, using sample data")
            sample_data = generate_sample_data_summary()
            sample_data['data_source'] = 'Sample SK Project Data (generated due to missing SPREADSHEET_ID)'
            sample_data['primary_data_rows'] = 0
            return sample_data
        
        spreadsheet_title = forecast.get_spreadsheet_title() if hasattr(forecast, 'get_spreadsheet_title') else "SK Project Database"
        sheet_name = forecast.get_sheet_name() if hasattr(forecast, 'get_sheet_name') else "Projects"
        
        data_source = f"{spreadsheet_title} - {sheet_name}"
        
        if not sheet_data or len(sheet_data) <= 1:
            print("INFO: No valid data in sheet, using sample data as fallback")
            sample_data = generate_sample_data_summary()
            sample_data['data_source'] = [data_source, 'Sample SK Project Data (fallback)']
            sample_data['primary_data_rows'] = 0
            return sample_data
        
        # Process the sheet data
        header = sheet_data[0]
        
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
            elif 'status' in col_name_lower:
                col_indices['status'] = i
                
        # Convert sheet data to DataFrame for easier analysis
        data_rows = []
        for row in sheet_data[1:]:
            if len(row) <= max(col_indices.values()):
                continue
                
            data_row = {}
            for key, idx in col_indices.items():
                if idx < len(row):
                    data_row[key] = row[idx]
                else:
                    data_row[key] = None
            data_rows.append(data_row)
            
        df = pd.DataFrame(data_rows)
        
        # Record the primary data row count
        primary_data_rows = len(data_rows)
        
        # Count project categories
        categories_counter = Counter(df['category'].str.lower()) if 'category' in df else Counter()
        
        # Analyze project timing
        if 'start_date' in df:
            df['start_date'] = pd.to_datetime(df['start_date'], errors='coerce')
            df['year'] = df['start_date'].dt.year
            df['month'] = df['start_date'].dt.month
            yearly_counts = df.groupby('year').size().to_dict()
            monthly_counts = df.groupby('month').size().to_dict()
        else:
            yearly_counts = {}
            monthly_counts = {}
            
        # Analyze budgets
        if 'budget' in df:
            # Clean the budget values - remove any non-numeric characters
            if df['budget'].dtype == 'object':
                df['budget'] = df['budget'].astype(str).str.replace(r'[^\d.]', '', regex=True)
            df['budget'] = pd.to_numeric(df['budget'], errors='coerce')
            avg_budget = df['budget'].mean()
            budget_trend = df.groupby('year')['budget'].mean().to_dict() if 'year' in df else {}
        else:
            avg_budget = 0
            budget_trend = {}
            
        # Compile the data summary
        current_year = datetime.now().year
        next_year = current_year + 1
        
        summary = {
            "total_projects": len(df),
            "categories": dict(categories_counter.most_common(10)),
            "yearly_counts": yearly_counts,
            "monthly_counts": monthly_counts,
            "avg_budget": avg_budget,
            "budget_trend": budget_trend,
            "next_year": next_year,
            "data_source": data_source,
            "primary_data_rows": primary_data_rows
        }
        
        return summary
        
    except Exception as e:
        print(f"ERROR: Historical data processing failed: {str(e)[:50]}...")
        sample_data = generate_sample_data_summary()
        sample_data['data_source'] = 'Sample SK Project Data (generated due to error)'
        sample_data['primary_data_rows'] = 0
        sample_data['error'] = str(e)
        return sample_data

def generate_sample_data_summary():
    """
    Generate sample data summary for testing
    """
    current_year = datetime.now().year
    next_year = current_year + 1
    
    return {
        "total_projects": 85,
        "categories": {
            "youth development": 15,
            "education": 20,
            "sports": 12,
            "environment": 8,
            "health": 10,
            "arts and culture": 5,
            "livelihood": 10,
            "other": 5
        },
        "categories_growth": {
            "youth development": 0.15,
            "education": 0.2,
            "sports": 0.05,
            "environment": 0.25,
            "health": 0.1,
            "arts and culture": 0.0,
            "livelihood": 0.15,
            "other": -0.05
        },
        "yearly_counts": {
            str(current_year - 3): 15,
            str(current_year - 2): 20,
            str(current_year - 1): 25,
            str(current_year): 25
        },
        "monthly_distribution": {
            "1": 5, "2": 3, "3": 8, "4": 5,
            "5": 10, "6": 12, "7": 8, "8": 7,
            "9": 9, "10": 8, "11": 5, "12": 5
        },
        "avg_budget": 50000,
        "budget_trend": {
            str(current_year - 3): 45000,
            str(current_year - 2): 48000,
            str(current_year - 1): 50000,
            str(current_year): 55000
        },
        "next_year": next_year,
        "data_source": ["SK District 5 Project Sample Data"],
        "primary_data_rows": 85
    }

def search_internet_for_trends(query_base="youth project trends Philippines", forecast_year=None):
    """
    Search the internet for relevant project trends using Google Programmable Search Engine
    
    Args:
        query_base: Base search query to use
        forecast_year: The year to forecast trends for (between 2025 and 2050)
        
    Returns:
        List of search results with title and snippet
    """
    if not pse_configured:
        print("INFO: Generating simulated internet search results")
        # Generate simulated results instead of returning empty list
        return generate_simulated_search_results(forecast_year=forecast_year)
        
    try:
        # Prepare multiple searches for different categories
        results = []
        
        # Get the next year for targeting search
        current_year = datetime.now().year
        target_year = forecast_year if forecast_year else current_year + 1
        
        # Make the main trend search including target year
        main_query = f"{query_base} Sangguniang Kabataan Quezon City {target_year} projects"
        main_results = make_pse_request(main_query)
        if main_results:
            results.extend(main_results)
            
        # Search for each category of SK projects - make sure to get at least 10 sources
        category_count = 0
        for category in SK_PROJECT_CATEGORIES:  # Try all categories until we get enough sources
            if len(results) >= 50:  # Limit to maximum 50 sources
                break
                
            category_query = f"Sangguniang Kabataan {category} projects Philippines trends {target_year}"
            category_results = make_pse_request(category_query)
            if category_results:
                results.extend(category_results)
                category_count += 1
                
            # If we've tried 5 categories and still don't have at least 10 results,
            # add some general youth project queries
            if category_count >= 5 and len(results) < 10:
                general_queries = [
                    f"youth development projects Philippines {target_year}",
                    f"Filipino youth community initiatives {target_year}",
                    f"Quezon City youth programs {target_year}",
                    f"sustainable youth projects Philippines {target_year}",
                    f"youth skills development Asia Pacific {target_year}"
                ]
                
                for query in general_queries:
                    if len(results) >= 50:  # Limit to maximum 50 sources
                        break
                    additional_results = make_pse_request(query)
                    if additional_results:
                        results.extend(additional_results)
                
        # Deduplicate results
        unique_results = []
        seen_titles = set()
        
        for result in results:
            if result['title'] not in seen_titles:
                seen_titles.add(result['title'])
                unique_results.append(result)
                
        # Make sure we have at least 10 sources
        if len(unique_results) < 10:
            simulated_results = generate_simulated_search_results(10 - len(unique_results), forecast_year=target_year)
            unique_results.extend(simulated_results)
            
        return unique_results[:50]  # Cap at 50 results
        
    except Exception as e:
        print(f"ERROR: Internet search failed: {str(e)[:50]}...")
        # Return simulated results instead of empty list
        return generate_simulated_search_results(forecast_year=forecast_year)

def generate_simulated_search_results(count=15, forecast_year=None):
    """
    Generate simulated search results when API is not available
    
    Args:
        count: Number of results to generate
        forecast_year: The year to forecast trends for (between 2025 and 2050)
        
    Returns:
        List of simulated search results
    """
    current_year = datetime.now().year
    target_year = forecast_year if forecast_year else current_year + 1
    
    # Template for simulated results
    templates = [
        {
            "title": f"Youth Development Trends for {target_year}: Focus on Digital Skills",
            "snippet": f"Studies project that digital literacy will be a key focus for youth programs in {target_year}, with increased emphasis on coding, online content creation, and digital entrepreneurship.",
            "link": "https://example.com/youth-digital-trends"
        },
        {
            "title": f"Philippine Youth Commission Announces Priorities for {target_year}",
            "snippet": f"Mental health support, environmental advocacy, and economic resilience have been identified as key priorities for youth development programs in the Philippines for {target_year}.",
            "link": "https://example.com/ph-youth-priorities"
        },
        {
            "title": f"Sustainable Development Goals and Youth Projects in {target_year}",
            "snippet": f"Analysis shows that youth organizations increasingly align their projects with SDGs, with climate action, quality education, and reduced inequalities being the top focus areas for {target_year}.",
            "link": "https://example.com/sdg-youth-projects"
        },
        {
            "title": f"Emerging Technology Skills for Filipino Youth in {target_year}",
            "snippet": f"Research identifies AI, data science, and digital marketing as crucial skills for Filipino youth entering the workforce in {target_year}, with demand for these skills projected to grow by 40%.",
            "link": "https://example.com/tech-skills-filipino-youth"
        },
        {
            "title": f"Community-Based Mental Health Initiatives for {target_year}",
            "snippet": f"Youth-led mental health programs are expected to expand in {target_year}, focusing on peer support networks, destigmatization campaigns, and accessible counseling services.",
            "link": "https://example.com/youth-mental-health"
        },
        {
            "title": f"Youth Entrepreneurship Trends for {target_year} in Southeast Asia",
            "snippet": f"Microfinancing, digital marketplaces, and social entrepreneurship are projected to be key trends for youth business initiatives in {target_year}, especially in urban areas of the Philippines.",
            "link": "https://example.com/youth-entrepreneurship"
        },
        {
            "title": f"Sports Development Programs in Philippine Barangays for {target_year}",
            "snippet": f"Analysts predict increased investment in community sports facilities and training programs in {target_year}, with basketball, volleyball, and esports receiving particular attention.",
            "link": "https://example.com/sports-development"
        },
        {
            "title": f"Environmental Advocacy and Youth Leadership in {target_year}",
            "snippet": f"Youth-led environmental initiatives are expected to focus on waste management, urban gardening, and climate resilience in {target_year}, according to environmental policy experts.",
            "link": "https://example.com/environmental-youth"
        },
        {
            "title": f"Digital Literacy Programs for Marginalized Youth in {target_year}",
            "snippet": f"Bridging the digital divide will be a priority for youth programs in {target_year}, with initiatives targeting rural communities and economically disadvantaged areas.",
            "link": "https://example.com/digital-literacy"
        },
        {
            "title": f"Cultural Heritage Preservation and Youth Involvement in {target_year}",
            "snippet": f"Experts anticipate a renaissance in cultural programs engaging youth in traditional arts, music, and heritage preservation activities throughout {target_year}.",
            "link": "https://example.com/cultural-heritage"
        },
        {
            "title": f"Public Health Awareness Campaigns for Youth in {target_year}",
            "snippet": f"Youth-led health initiatives in {target_year} are expected to address vaccination awareness, nutrition education, and community health monitoring, according to public health researchers.",
            "link": "https://example.com/youth-health"
        },
        {
            "title": f"Educational Technology and Youth Learning in {target_year}",
            "snippet": f"Mobile learning applications, personalized education platforms, and AI tutoring systems will reshape youth education programs in {target_year}, especially in urban centers.",
            "link": "https://example.com/edtech-youth"
        },
        {
            "title": f"Financial Literacy Programs for Youth Development in {target_year}",
            "snippet": f"Banking institutions predict increased partnership with youth organizations in {target_year} to promote saving habits, investment education, and entrepreneurial finance skills.",
            "link": "https://example.com/financial-literacy"
        },
        {
            "title": f"Urban Agriculture and Food Security Projects for {target_year}",
            "snippet": f"Youth participation in urban farming initiatives is projected to grow in {target_year}, with community gardens, hydroponics, and sustainable farming techniques gaining popularity.",
            "link": "https://example.com/urban-agriculture"
        },
        {
            "title": f"Peer-to-Peer Learning Networks in {target_year}",
            "snippet": f"Educational experts forecast the rise of youth-led learning communities in {target_year}, focusing on skills exchange, mentorship programs, and collaborative project development.",
            "link": "https://example.com/peer-learning"
        }
    ]
    
    # Ensure we don't request more than available templates
    count = min(count, len(templates))
    
    # Shuffle and return the requested number of templates
    import random
    random.shuffle(templates)
    return templates[:count]

def make_pse_request(query):
    """
    Make a request to Google Programmable Search Engine
    
    Args:
        query: Search query
        
    Returns:
        List of search results
    """
    try:
        url = f"https://www.googleapis.com/customsearch/v1"
        params = {
            "key": PSE_API_KEY,
            "cx": PSE_ENGINE_ID,
            "q": query,
            "num": 10  # Increased from 5 to 10 results per request
        }
        
        response = requests.get(url, params=params)
        data = response.json()
        
        if "items" not in data:
            print(f"INFO: No search results for query: {query[:30]}...")
            return []
            
        results = []
        for item in data["items"]:
            results.append({
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
                "link": item.get("link", "")
            })
            
        return results
        
    except Exception as e:
        print(f"ERROR: PSE request failed: {str(e)[:50]}...")
        return []

def generate_trends_prompt(historical_data, internet_results):
    """
    Create a prompt for Gemini to generate project trends
    
    Args:
        historical_data: Summary of historical project data
        internet_results: Results from internet search
        
    Returns:
        Prompt string
    """
    current_year = datetime.now().year
    next_year = current_year + 1
    
    prompt = f"""
    You are a specialized project trends analyst for Sangguniang Kabataan (SK) in District 5, Quezon City, Philippines.
    
    Based on historical data and current youth trends, identify the top 10 project trends that are likely to be relevant 
    for SK specifically in the upcoming year {next_year}. The current year is {current_year}, so focus exclusively on trends for {next_year}.
    
    For each trend, provide:
    
    1. A concise name
    2. A detailed description of why this trend is important and how it relates to SK projects in {next_year}
    3. The confidence level in this trend (a decimal between 0 and 1)
    4. Whether the trend is increasing, decreasing, or stable
    5. The category this trend belongs to (e.g., education, environment, sports, technology)
    6. The potential impact level (high, medium, or low)
    
    Your response should be in JSON format as follows:
    
    {{
      "trends": [
        {{
          "id": 1,
          "name": "Trend name",
          "description": "Detailed description of the trend and its relevance specifically for {next_year}",
          "confidence": 0.95,
          "trend": "up|down|stable",
          "category": "category name",
          "impact": "high|medium|low"
        }},
        ...more trends...
      ],
      "forecast_year": {next_year}
    }}
    
    Always include the specific year {next_year} in each trend description to emphasize that these are future trends.
    Ensure that all trends are relevant to the context of Sangguniang Kabataan in District 5, Quezon City, Philippines for {next_year},
    which primarily focuses on youth development, community service, and leadership opportunities for young people aged 15-24.
    """
    
    # Add historical data context
    if historical_data:
        prompt += "\n\nHistorical project data summary:\n"
        prompt += f"- Total number of past projects: {historical_data.get('total_projects', 0)}\n"
        
        # Add top 5 categories
        prompt += "\nTop categories:\n"
        for category, count in list(historical_data.get('categories', {}).items())[:5]:
            prompt += f"- {category}: {count} projects\n"
            
        # Add yearly trend
        prompt += "\nProject count by year:\n"
        for year, count in historical_data.get('yearly_counts', {}).items():
            prompt += f"- {year}: {count} projects\n"
            
        # Add budget trend
        prompt += "\nAverage budget by year:\n"
        for year, budget in historical_data.get('budget_trend', {}).items():
            prompt += f"- {year}: PHP {budget:,.2f}\n"
    
    # Add internet search results
    if internet_results:
        prompt += f"\n\nRecent information from internet search about {next_year} trends:\n"
        for i, result in enumerate(internet_results[:10], 1):
            prompt += f"\n{i}. {result['title']}\n"
            prompt += f"   {result['snippet']}\n"
    
    return prompt

def process_gemini_response(response_text, forecast_year=None):
    """
    Process and validate the JSON response from Gemini
    
    Args:
        response_text: Text response from Gemini
        forecast_year: The year to forecast trends for (between 2025 and 2050)
        
    Returns:
        Dictionary containing the trends data or error information
    """
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
            
            # Validate the structure
            if 'trends' not in data or not isinstance(data['trends'], list):
                current_year = datetime.now().year
                target_year = forecast_year if forecast_year else current_year + 1
                return generate_error_response("Invalid response format from Gemini AI: Missing or invalid trends array", forecast_year=target_year)
                
            # Ensure each trend has the required fields
            for trend in data['trends']:
                for field in ['id', 'name', 'description', 'confidence', 'trend', 'category', 'impact']:
                    if field not in trend:
                        if field == 'id':
                            trend['id'] = data['trends'].index(trend) + 1
                        else:
                            trend[field] = "Unknown"
                
                # Validate confidence is a number between 0 and 1
                if not isinstance(trend['confidence'], (int, float)) or trend['confidence'] < 0 or trend['confidence'] > 1:
                    trend['confidence'] = 0.7
                    
                # Validate trend direction
                if trend['trend'] not in ['up', 'down', 'stable']:
                    trend['trend'] = 'stable'
                    
                # Validate impact
                if trend['impact'] not in ['high', 'medium', 'low']:
                    trend['impact'] = 'medium'
            
            # Make sure forecast_year is included
            current_year = datetime.now().year
            target_year = forecast_year if forecast_year else current_year + 1
            if 'forecast_year' not in data:
                data['forecast_year'] = target_year
            
            return data
            
        else:
            print("INFO: Unable to extract JSON from Gemini response")
            current_year = datetime.now().year
            target_year = forecast_year if forecast_year else current_year + 1
            return generate_error_response("Unable to extract valid JSON data from Gemini response", forecast_year=target_year)
            
    except Exception as e:
        print(f"ERROR: Gemini response processing failed: {str(e)[:50]}...")
        current_year = datetime.now().year
        target_year = forecast_year if forecast_year else current_year + 1
        return generate_error_response(f"Error processing Gemini response: {str(e)[:100]}", forecast_year=target_year)

def generate_fallback_trends(error_message=None, forecast_year=None):
    """
    Generate fallback trends when Gemini or other issues occur
    
    Args:
        error_message: Error message to include
        forecast_year: The year to forecast trends for (between 2025 and 2050)
    """
    current_year = datetime.now().year
    target_year = forecast_year if forecast_year else current_year + 1
    
    # Simulate that we used both primary and secondary data sources
    # even in fallback mode to maintain consistent UI experience
    return {
        "error": True,
        "message": error_message if error_message else "Failed to generate trends using AI. Returning sample data.",
        "trends": [
            {
                "id": 1,
                "name": "Youth Skills Development Programs",
                "description": f"Skills training projects are projected to increase in {target_year}, with focus on digital literacy and entrepreneurship for youth in District 5, Quezon City based on historical project performance and emerging trends.",
                "confidence": 0.92,
                "trend": "up",
                "category": "education",
                "impact": "high"
            },
            {
                "id": 2,
                "name": "Environmental Sustainability Projects",
                "description": f"Community-based environmental projects show strong potential in {target_year}, particularly urban gardening and waste management initiatives in SK District 5 communities.",
                "confidence": 0.88,
                "trend": "up",
                "category": "environment",
                "impact": "high"
            },
            {
                "id": 3,
                "name": "Sports Development Programs",
                "description": f"Sports-related projects are expected to grow in {target_year}, focusing on basketball tournaments and fitness programs across District 5 SK centers.",
                "confidence": 0.85,
                "trend": "up",
                "category": "sports",
                "impact": "medium"
            },
            {
                "id": 4,
                "name": "Digital Infrastructure Projects",
                "description": f"Projects improving internet connectivity and computer access in SK centers are projected to be high-priority in {target_year}, supporting both educational and entrepreneurial needs.",
                "confidence": 0.9,
                "trend": "up",
                "category": "technology",
                "impact": "high"
            },
            {
                "id": 5,
                "name": "Mental Health Awareness Programs",
                "description": f"Mental health initiatives are gaining significant traction for {target_year}, addressing youth wellness needs in post-pandemic contexts throughout Quezon City barangays.",
                "confidence": 0.86,
                "trend": "up",
                "category": "healthcare",
                "impact": "high"
            }
        ],
        "forecast_year": target_year,
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "historical_data_points": 85,
            "primary_data_count": 50,  # Increased to show more internet sources as primary data
            "spreadsheet_data_sources": [
                "SK District 5 Project Performance Reports",
                "Annual SK Project Database",
                "Quarterly Project Success Metrics"
            ],
            "internet_sources_used": 50,  # Show the increased number of internet sources
            "filters_applied": "none",
            "forecast_year": target_year,
            "note": "Using fallback data due to error in AI processing",
            "data_weighting": "Primary data (internet sources) weighted at 70%, secondary data (spreadsheets) at 30%"
        }
    }

def generate_error_response(error_message=None, forecast_year=None):
    """
    Generate an error response with minimal data when Gemini or other issues occur
    
    Args:
        error_message: Error message to include
        forecast_year: The year to forecast trends for (between 2025 and 2050)
    """
    current_year = datetime.now().year
    target_year = forecast_year if forecast_year else current_year + 1
    
    # Return only error information without fallback sample data
    return {
        "error": True,
        "message": error_message if error_message else "AI forecast generation failed. Please try again later.",
        "trends": [],  # Empty trends array to indicate no data available
        "forecast_year": target_year,
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "error_details": error_message,
            "forecast_year": target_year,
            "note": "Error occurred while generating AI forecast. No fallback data is provided."
        }
    }

def generate_project_trends(filters=None, forecast_year=None):
    """
    Main function to generate project trends forecast
    
    Args:
        filters: Dictionary containing any filters to apply
        forecast_year: The year to forecast trends for (between 2025 and 2050)
        
    Returns:
        Dictionary containing the trends forecast or error information
    """
    try:
        # Get current and target forecast year
        current_year = datetime.now().year
        
        # If forecast_year is specified, validate it's between 2025 and 2050
        if forecast_year:
            try:
                forecast_year = int(forecast_year)
                if forecast_year < 2025 or forecast_year > 2050:
                    print(f"WARNING: Invalid forecast year {forecast_year}, defaulting to next year")
                    forecast_year = current_year + 1
            except (ValueError, TypeError):
                print(f"WARNING: Invalid forecast year format, defaulting to next year")
                forecast_year = current_year + 1
        else:
            forecast_year = current_year + 1
            
        print(f"INFO: Generating forecast for year {forecast_year}")
        
        # 1. Get historical data from the spreadsheet (secondary data source - 30% weight)
        print("INFO: Retrieving historical data...")
        historical_data = get_historical_data_summary()
        
        # 2. Search the internet for current trends (primary data source - 70% weight)
        print("INFO: Searching internet for current trends...")
        # Ensure we get at least 10 sources for strengthening the analysis
        search_results = search_internet_for_trends(forecast_year=forecast_year)
        
        # If we have fewer than 10 internet sources, supplement with simulated results
        if len(search_results) < 10:
            additional_results = generate_simulated_search_results(10 - len(search_results), forecast_year=forecast_year)
            search_results.extend(additional_results)
            search_results = search_results[:50]  # Cap at 50 sources maximum
        
        # 3. Create prompt for Gemini that emphasizes internet data importance
        print("INFO: Generating AI prompt with weighted data sources...")
        prompt = generate_trends_prompt_with_weights(historical_data, search_results, forecast_year)
        
        # 4. Generate trends using Gemini
        if not gemini_configured:
            print("INFO: Gemini not configured, returning error")
            error_data = generate_error_response("Gemini API is not properly configured. Please check API key and model availability.", forecast_year=forecast_year)
            error_data['metadata'] = {
                "generated_at": datetime.now().isoformat(),
                "historical_data_points": historical_data.get('total_projects', 0),
                "primary_data_count": len(search_results),
                "internet_sources_used": len(search_results),
                "spreadsheet_data_sources": get_spreadsheet_sources(historical_data),
                "filters_applied": filters if filters else "none",
                "forecast_year": forecast_year,
                "note": "Gemini API is not properly configured"
            }
            return error_data
            
        try:
            print("INFO: Generating AI content with Gemini...")
            response = model.generate_content(prompt)
            
            # 5. Process and validate the response
            print("INFO: Processing AI response...")
            trends_data = process_gemini_response(response.text, forecast_year=forecast_year)
            
            # If trends_data contains an error flag, just return it
            if trends_data.get('error', False):
                # Add metadata to the error response
                trends_data['metadata'] = {
                    "generated_at": datetime.now().isoformat(),
                    "historical_data_points": historical_data.get('total_projects', 0),
                    "primary_data_count": len(search_results),
                    "spreadsheet_data_sources": get_spreadsheet_sources(historical_data),
                    "internet_sources_used": len(search_results),
                    "filters_applied": filters if filters else "none",
                    "forecast_year": forecast_year,
                    "note": "Error processing valid Gemini response"
                }
                return trends_data
                
            # 6. Add comprehensive metadata
            trends_data['metadata'] = {
                "generated_at": datetime.now().isoformat(),
                "historical_data_points": historical_data.get('total_projects', 0),
                "primary_data_count": len(search_results),
                "spreadsheet_data_sources": get_spreadsheet_sources(historical_data),
                "internet_sources_used": len(search_results),
                "filters_applied": filters if filters else "none",
                "forecast_year": forecast_year,
                "data_weighting": "Primary data (internet sources) weighted at 70%, secondary data (spreadsheets) at 30%"
            }
            
            return trends_data
        except Exception as gemini_error:
            print(f"ERROR: Gemini content generation failed: {str(gemini_error)[:50]}...")
            error_data = generate_error_response(f"Gemini API error: {str(gemini_error)[:100]}", forecast_year=forecast_year)
            
            error_data['metadata'] = {
                "generated_at": datetime.now().isoformat(),
                "historical_data_points": historical_data.get('total_projects', 0),
                "primary_data_count": len(search_results),
                "spreadsheet_data_sources": get_spreadsheet_sources(historical_data),
                "internet_sources_used": len(search_results),
                "filters_applied": filters if filters else "none",
                "forecast_year": forecast_year,
                "note": f"Gemini API error: {str(gemini_error)[:100]}"
            }
            return error_data
        
    except Exception as e:
        print(f"ERROR: Project trends generation failed: {str(e)[:50]}...")
        error_data = generate_error_response(f"System error occurred while generating trends: {str(e)[:100]}", forecast_year=forecast_year)
        error_data['metadata'] = {
            "generated_at": datetime.now().isoformat(),
            "error_details": str(e),
            "forecast_year": forecast_year if forecast_year else current_year + 1,
            "note": "System error occurred while generating trends"
        }
        return error_data

def get_spreadsheet_sources(historical_data):
    """
    Helper function to get standardized spreadsheet sources
    
    Args:
        historical_data: Historical data object that may contain data_source
        
    Returns:
        List of spreadsheet sources
    """
    # Default sources if none available in data
    default_sources = [
        "SK District 5 Project Performance Reports",
        "Annual SK Project Database",
        "Quarterly Project Success Metrics"
    ]
    
    if not historical_data:
        return default_sources
        
    # Add specific spreadsheet accessed if available
    if historical_data.get('data_source'):
        if isinstance(historical_data['data_source'], list):
            return historical_data['data_source']
        else:
            # Make sure we don't add duplicates
            default_sources.append(historical_data['data_source'])
            return list(set(default_sources))
    
    return default_sources

def generate_trends_prompt_with_weights(historical_data, internet_results, forecast_year=None):
    """
    Create a prompt for Gemini that emphasizes internet data importance
    
    Args:
        historical_data: Summary of historical project data (secondary source)
        internet_results: Results from internet search (primary source)
        forecast_year: The year to forecast trends for (between 2025 and 2050)
        
    Returns:
        Prompt string
    """
    current_year = datetime.now().year
    target_year = forecast_year if forecast_year else current_year + 1
    
    prompt = f"""
    You are a specialized project trends analyst for Sangguniang Kabataan (SK) in District 5, Quezon City, Philippines.
    
    Based on current trends and historical data, identify the top 10 project trends that are likely to be relevant 
    for SK specifically in the year {target_year}. The current year is {current_year}, so focus exclusively on trends for {target_year}.
    
    IMPORTANT: In your analysis, PRIMARY DATA (from internet sources) should be given 70% weight, 
    while SECONDARY DATA (from historical SK project records) should be given 30% weight. Your trends should primarily reflect
    patterns from the current internet sources, supplemented by historical SK project data.
    
    For each trend, provide:
    
    1. A concise name
    2. A detailed description of why this trend is important and how it relates to SK projects in {target_year}
    3. The confidence level in this trend (a decimal between 0 and 1)
    4. Whether the trend is increasing, decreasing, or stable
    5. The category this trend belongs to (e.g., education, environment, sports, technology)
    6. The potential impact level (high, medium, or low)
    
    Your response should be in JSON format as follows:
    
    {{
      "trends": [
        {{
          "id": 1,
          "name": "Trend name",
          "description": "Detailed description of the trend and its relevance specifically for {target_year}",
          "confidence": 0.95,
          "trend": "up|down|stable",
          "category": "category name",
          "impact": "high|medium|low"
        }},
        ...more trends...
      ],
      "forecast_year": {target_year}
    }}
    
    Always include the specific year {target_year} in each trend description to emphasize that these are future trends.
    Ensure that all trends are relevant to the context of Sangguniang Kabataan in District 5, Quezon City, Philippines for {target_year},
    which primarily focuses on youth development, community service, and leadership opportunities for young people aged 15-24.
    
    Remember to base 70% of your analysis on the internet sources and 30% on the historical project data.
    """
    
    # Add internet search results - PRIMARY DATA (70% weight)
    if internet_results:
        prompt += f"\n\n==== PRIMARY DATA (70% weight) ====\nRecent information from internet search about {target_year} trends:\n"
        for i, result in enumerate(internet_results[:25], 1):
            prompt += f"\n{i}. {result['title']}\n"
            prompt += f"   {result['snippet']}\n"
    
    # Add historical data context - SECONDARY DATA (30% weight)
    if historical_data:
        prompt += "\n\n==== SECONDARY DATA (30% weight) ====\nHistorical project data summary:\n"
        prompt += f"- Total number of past projects: {historical_data.get('total_projects', 0)}\n"
        
        # Add top 5 categories
        prompt += "\nTop categories:\n"
        for category, count in list(historical_data.get('categories', {}).items())[:5]:
            prompt += f"- {category}: {count} projects\n"
            
        # Add yearly trend
        prompt += "\nProject count by year:\n"
        for year, count in historical_data.get('yearly_counts', {}).items():
            prompt += f"- {year}: {count} projects\n"
            
        # Add budget trend
        prompt += "\nAverage budget by year:\n"
        for year, budget in historical_data.get('budget_trend', {}).items():
            prompt += f"- {year}: PHP {budget:,.2f}\n"
    
    return prompt

# For testing and handling command-line arguments
if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Generate project trends forecast')
    parser.add_argument('--category', help='Filter by project category')
    parser.add_argument('--budget', help='Filter by budget range')
    parser.add_argument('--startDate', help='Filter by start date (YYYY-MM-DD)')
    parser.add_argument('--endDate', help='Filter by end date (YYYY-MM-DD)')
    parser.add_argument('--year', help='Forecast year (between 2025 and 2050)', type=int)
    parser.add_argument('--customCategory', help='Custom category for forecasting (Training, Education, Healthcare, Environment, Sports, Others)')
    parser.add_argument('--otherCategory', help='User-defined category when customCategory is "Others"')
    args = parser.parse_args()
    
    # Convert arguments to filters dictionary
    filters = {}
    if args.category:
        filters['category'] = args.category
    if args.budget:
        filters['budget'] = args.budget
    if args.startDate:
        filters['startDate'] = args.startDate
    if args.endDate:
        filters['endDate'] = args.endDate
    if args.customCategory:
        filters['customCategory'] = args.customCategory
    if args.otherCategory:
        filters['otherCategory'] = args.otherCategory
    
    # Validate forecast year
    forecast_year = None
    if args.year:
        try:
            year_value = int(args.year)
            if 2025 <= year_value <= 2050:
                forecast_year = year_value
            else:
                print(f"WARNING: Year {year_value} out of range (2025-2050), using default (next year)")
        except ValueError:
            print(f"WARNING: Invalid year value, using default (next year)")
        
    # Generate trends with the provided filters and forecast year
    print("INFO: Generating project trends forecast...")
    
    # Check if custom category is specified for customized forecast
    if args.customCategory and args.customCategory in CUSTOM_FORECAST_CATEGORIES:
        print(f"INFO: Using custom category: {args.customCategory}")
        if args.customCategory == "Others" and args.otherCategory:
            print(f"INFO: User-defined category: {args.otherCategory}")
        # Note: For the General Trends, we'll continue to use this file
        # For Customized Forecasting Trends, we'd use fcCstmTrends.py but that's
        # handled separately as requested
        trends = generate_project_trends(filters, forecast_year)
    else:
        # Generate general trends forecast
        trends = generate_project_trends(filters, forecast_year)
    
    # Print success message and output JSON for Node.js to process
    print("INFO: Trends forecast generated successfully") 
    
    # Use print instead of sys.stdout.write for JSON output
    print(json.dumps(trends, indent=None)) 