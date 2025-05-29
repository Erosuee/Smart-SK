import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Box,
  CircularProgress,
  Alert,
  Divider,
  Chip
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoIcon from '@mui/icons-material/Info';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface AnalysisData {
  summary: string;
  trends: Array<{
    title: string;
    description: string;
    type: string;
  }>;
  recommendations: string[];
  confidence: number;
  source?: string;
  gemini_powered?: boolean;
}

interface ResponseProps {
  filters?: {
    category?: string;
    budget?: string;
    startDate?: string;
    endDate?: string;
  };
}

const Response: React.FC<ResponseProps> = ({ filters }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  
  // Fetch analysis data from the backend
  useEffect(() => {
    const fetchAnalysisData = async () => {
      try {
        setLoading(true);
        setError(null);
        setApiErrorMessage(null);
        
        // Build query parameters from filters
        const queryParams = new URLSearchParams();
        if (filters) {
          if (filters.category && filters.category !== 'all') queryParams.append('category', filters.category);
          if (filters.budget && filters.budget !== 'all') queryParams.append('budget', filters.budget);
          if (filters.startDate) queryParams.append('startDate', filters.startDate);
          if (filters.endDate) queryParams.append('endDate', filters.endDate);
        }
        
        // Add a timestamp to prevent caching issues
        queryParams.append('_t', Date.now().toString());
        
        // Get the authentication token from localStorage
        const token = localStorage.getItem('token');
        
        // Construct URL with query parameters
        const url = `http://localhost:3000/api/forecast-analysis${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        
        // Connect to the backend server
        const response = await fetch(url, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // Parse the response
        const data = await response.json();
        
        console.log('Received forecast analysis data:', data);
        
        // Check if the data contains an error
        if (data && data.error) {
          console.error('API returned error:', data.message);
          setApiErrorMessage(data.message || 'Failed to generate forecast analysis');
          setAnalysisData(null);
          setLoading(false);
          return;
        }
        
        // Extract analysis from the response
        if (data) {
          // Handle either direct analysis object or nested structure
          if (data.analysis) {
            console.log('Using analysis from data.analysis');
            const analysisWithSource = {
              ...data.analysis,
              // Add source information if available, or indicate if it's from Gemini
              source: data.analysis.source || (data.gemini_powered ? 'Gemini AI' : 'Fallback Analysis'),
              gemini_powered: data.gemini_powered || data.analysis.gemini_powered || false
            };
            setAnalysisData(analysisWithSource);
          } else if (data.forecast_data && data.forecast_data.analysis) {
            // Handle nested structure
            console.log('Using analysis from data.forecast_data.analysis');
            const analysisWithSource = {
              ...data.forecast_data.analysis,
              // Add source information if available, or indicate if it's from Gemini
              source: data.forecast_data.analysis.source || (data.gemini_powered ? 'Gemini AI' : 'Fallback Analysis'),
              gemini_powered: data.gemini_powered || data.forecast_data.analysis.gemini_powered || false
            };
            setAnalysisData(analysisWithSource);
          } else {
            // Log the structure we received to help debugging
            console.log('No analysis data found in response structure:', Object.keys(data));
            setError('No analysis data found in server response');
          }
        } else {
          setError('No data received from server');
        }
        
      } catch (error) {
        console.error('Error fetching analysis data:', error);
        setError('Failed to connect to analysis API. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalysisData();
  }, [filters]);

  // Renders a trend item with appropriate icon
  const renderTrendItem = (trend: { title: string, description: string, type: string }, index: number) => {
    const getIcon = () => {
      switch(trend.type) {
        case 'positive':
          return <TrendingUpIcon sx={{ color: 'success.main' }} />;
        case 'negative':
          return <TrendingDownIcon sx={{ color: 'error.main' }} />;
        default:
          return <InfoIcon sx={{ color: 'info.main' }} />;
      }
    };

    return (
      <Box key={index} sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {getIcon()}
        <Box>
          <Typography variant="subtitle1" fontWeight="medium">
            {trend.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {trend.description}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <div style={{ width: '100%', marginTop: '24px' }}>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="200px">
          <CircularProgress />
        </Box>
      ) : (
        <Paper elevation={3} className="chart-paper">
          <Box p={3}>
            <Box display="flex" alignItems="center" mb={2}>
              <AnalyticsIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h5" component="h2">
                Forecast Analysis
              </Typography>
              {analysisData && !apiErrorMessage && (
                <Chip 
                  label={`${Math.round((analysisData.confidence || 0.7) * 100)}% confidence`} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                  sx={{ ml: 2 }}
                />
              )}
            </Box>
            
            {apiErrorMessage ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
                <WarningAmberIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom align="center">
                  AI Analysis Temporarily Unavailable
                </Typography>
                <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 600, mb: 2 }}>
                  {apiErrorMessage}
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
                  Please try again later or contact system administrator for assistance.
                </Typography>
              </Box>
            ) : !analysisData ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" sx={{ py: 6 }}>
                <ErrorOutlineIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Analysis Data Available
                </Typography>
                <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 600 }}>
                  Unable to generate analysis for the forecast at this time.
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="body1" paragraph>
                  {analysisData.summary}
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, mt: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Key Trends
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box>
                      {analysisData.trends && analysisData.trends.map((trend, index) => 
                        renderTrendItem(trend, index)
                      )}
                      {(!analysisData.trends || analysisData.trends.length === 0) && (
                        <Typography variant="body2" color="text.secondary">
                          No trend data available.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Recommendations
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {analysisData.recommendations && analysisData.recommendations.map((recommendation, index) => (
                        <Typography component="li" variant="body1" key={index} sx={{ mb: 1 }}>
                          {recommendation}
                        </Typography>
                      ))}
                      {(!analysisData.recommendations || analysisData.recommendations.length === 0) && (
                        <Typography variant="body2" color="text.secondary">
                          No recommendations available.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
                
                <Box mt={3} p={2} bgcolor="rgba(240, 248, 255, 0.6)" borderRadius={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                      <strong>Note:</strong> This analysis is generated based on historical data and forecast algorithms. 
                      The accuracy of the response may vary depending on external factors and market conditions.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 2, mt: 1 }}>
                      {analysisData.gemini_powered && (
                        <Chip 
                          label="Powered by Gemini AI" 
                          size="small" 
                          color="primary" 
                          sx={{ fontSize: '0.7rem', height: '20px', mb: 1 }}
                        />
                      )}
                      {analysisData.source && !analysisData.gemini_powered && (
                        <Chip 
                          label={`Source: ${analysisData.source}`} 
                          size="small" 
                          color="default" 
                          sx={{ fontSize: '0.7rem', height: '20px' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </Paper>
      )}
    </div>
  );
};

export default Response;
