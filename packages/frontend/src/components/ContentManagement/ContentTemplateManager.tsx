import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

interface ContentTemplate {
  id: string;
  name: string;
  description?: string;
  templateType: 'blogger' | 'soloboss' | 'manual';
  platform: string;
  templateContent: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
}

const ContentTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [availableVariables, setAvailableVariables] = useState<Record<string, TemplateVariable[]>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateType: 'manual' as 'blogger' | 'soloboss' | 'manual',
    platform: 'all',
    templateContent: '',
    variables: [] as string[],
    isActive: true
  });

  useEffect(() => {
    loadTemplates();
    loadAvailableVariables();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVariables = async () => {
    try {
      const types = ['blogger', 'soloboss', 'manual'];
      const variablesData: Record<string, TemplateVariable[]> = {};
      
      for (const type of types) {
        const response = await fetch(`/api/templates/variables/${type}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          variablesData[type] = data.data.variables;
        }
      }
      
      setAvailableVariables(variablesData);
    } catch (error) {
      console.error('Error loading available variables:', error);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      templateType: 'manual',
      platform: 'all',
      templateContent: '',
      variables: [],
      isActive: true
    });
    setIsDialogOpen(true);
  };

  const handleEditTemplate = (template: ContentTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      templateType: template.templateType,
      platform: template.platform,
      templateContent: template.templateContent,
      variables: template.variables,
      isActive: template.isActive
    });
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      setLoading(true);
      const url = selectedTemplate 
        ? `/api/templates/${selectedTemplate.id}`
        : '/api/templates';
      
      const method = selectedTemplate ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await loadTemplates();
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTemplate = async (template: ContentTemplate) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/templates/${template.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sampleData: {} // Could be populated with sample data
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreviewContent(data.data.preview);
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error previewing template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTemplate = (template: ContentTemplate) => {
    setSelectedTemplate(null);
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      templateType: template.templateType,
      platform: template.platform,
      templateContent: template.templateContent,
      variables: template.variables,
      isActive: true
    });
    setIsDialogOpen(true);
  };

  const insertVariable = (variableName: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const newText = before + `{{${variableName}}}` + after;
      
      setFormData(prev => ({ ...prev, templateContent: newText }));
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableName.length + 4, start + variableName.length + 4);
      }, 0);
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Content Templates</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateTemplate}
        >
          Create Template
        </Button>
      </Box>

      <Grid container spacing={3}>
        {templates.map((template) => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="div">
                    {template.name}
                  </Typography>
                  <Box>
                    <Chip
                      label={template.templateType}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    {!template.isActive && (
                      <Chip
                        label="Inactive"
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Box>
                </Box>

                {template.description && (
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {template.description}
                  </Typography>
                )}

                <Box mb={2}>
                  <Typography variant="caption" display="block">
                    Platform: {template.platform}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Variables: {template.variables.length}
                  </Typography>
                </Box>

                <Box display="flex" gap={1}>
                  <IconButton
                    size="small"
                    onClick={() => handleEditTemplate(template)}
                    title="Edit"
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handlePreviewTemplate(template)}
                    title="Preview"
                  >
                    <PreviewIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleCopyTemplate(template)}
                    title="Copy"
                  >
                    <CopyIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteTemplate(template.id)}
                    title="Delete"
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Template Editor Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedTemplate ? 'Edit Template' : 'Create Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Template Type</InputLabel>
                <Select
                  value={formData.templateType}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    templateType: e.target.value as 'blogger' | 'soloboss' | 'manual'
                  }))}
                >
                  <MenuItem value="manual">Manual</MenuItem>
                  <MenuItem value="blogger">Blogger</MenuItem>
                  <MenuItem value="soloboss">SoloBoss</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Platform</InputLabel>
                <Select
                  value={formData.platform}
                  onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                >
                  <MenuItem value="all">All Platforms</MenuItem>
                  <MenuItem value="facebook">Facebook</MenuItem>
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="x">X (Twitter)</MenuItem>
                  <MenuItem value="pinterest">Pinterest</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="Active"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                id="template-content"
                fullWidth
                label="Template Content"
                multiline
                rows={8}
                value={formData.templateContent}
                onChange={(e) => setFormData(prev => ({ ...prev, templateContent: e.target.value }))}
                helperText="Use {{variable_name}} to insert variables"
              />
            </Grid>
            
            {/* Available Variables */}
            {availableVariables[formData.templateType] && (
              <Grid item xs={12}>
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Available Variables</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={1}>
                      {availableVariables[formData.templateType].map((variable) => (
                        <Grid item key={variable.name}>
                          <Chip
                            label={variable.name}
                            onClick={() => insertVariable(variable.name)}
                            clickable
                            size="small"
                            title={variable.description}
                          />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained" disabled={loading}>
            {selectedTemplate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.paper',
              whiteSpace: 'pre-wrap'
            }}
          >
            {previewContent}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentTemplateManager;