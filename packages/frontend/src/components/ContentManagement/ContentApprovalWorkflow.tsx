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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Divider,
  Alert,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';

interface ApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: ApprovalStep[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalStep {
  stepNumber: number;
  name: string;
  description?: string;
  requiredRoles: string[];
  requiredApprovers: number;
  allowSelfApproval: boolean;
  autoApprove?: boolean;
  timeoutHours?: number;
}

interface ApprovalRequest {
  id: string;
  postId: string;
  workflowId: string;
  requesterId: string;
  currentStep: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  postContent?: string;
  workflowName?: string;
}

interface WorkflowProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: number;
  pendingApprovers: string[];
  canApprove: boolean;
  nextSteps: ApprovalStep[];
}

const ContentApprovalWorkflow: React.FC = () => {
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state for workflow
  const [workflowForm, setWorkflowForm] = useState({
    name: '',
    description: '',
    steps: [] as ApprovalStep[],
    isDefault: false
  });

  // Form state for approval decision
  const [decisionForm, setDecisionForm] = useState({
    action: 'approve' as 'approve' | 'reject' | 'request_changes',
    comments: ''
  });

  useEffect(() => {
    loadWorkflows();
    loadPendingRequests();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/content-approval/workflows', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.data);
      }
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const response = await fetch('/api/content-approval/pending', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.data);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflow(null);
    setWorkflowForm({
      name: '',
      description: '',
      steps: [{
        stepNumber: 0,
        name: 'Review',
        description: '',
        requiredRoles: ['admin'],
        requiredApprovers: 1,
        allowSelfApproval: false
      }],
      isDefault: false
    });
    setIsWorkflowDialogOpen(true);
  };

  const handleEditWorkflow = (workflow: ApprovalWorkflow) => {
    setSelectedWorkflow(workflow);
    setWorkflowForm({
      name: workflow.name,
      description: workflow.description || '',
      steps: workflow.steps,
      isDefault: workflow.isDefault
    });
    setIsWorkflowDialogOpen(true);
  };

  const handleSaveWorkflow = async () => {
    try {
      setLoading(true);
      const url = selectedWorkflow 
        ? `/api/content-approval/workflows/${selectedWorkflow.id}`
        : '/api/content-approval/workflows';
      
      const method = selectedWorkflow ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(workflowForm)
      });
      
      if (response.ok) {
        await loadWorkflows();
        setIsWorkflowDialogOpen(false);
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDecision = async (requestId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content-approval/requests/${requestId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(decisionForm)
      });
      
      if (response.ok) {
        await loadPendingRequests();
        setIsRequestDialogOpen(false);
        setDecisionForm({ action: 'approve', comments: '' });
      }
    } catch (error) {
      console.error('Error processing decision:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (request: ApprovalRequest) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content-approval/requests/${request.id}/progress`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWorkflowProgress(data.data);
        setSelectedRequest(request);
        setIsProgressDialogOpen(true);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWorkflowStep = () => {
    const newStep: ApprovalStep = {
      stepNumber: workflowForm.steps.length,
      name: `Step ${workflowForm.steps.length + 1}`,
      description: '',
      requiredRoles: ['admin'],
      requiredApprovers: 1,
      allowSelfApproval: false
    };
    
    setWorkflowForm(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }));
  };

  const updateWorkflowStep = (index: number, step: ApprovalStep) => {
    setWorkflowForm(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? step : s)
    }));
  };

  const removeWorkflowStep = (index: number) => {
    setWorkflowForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'error';
      case 'high': return 'warning';
      case 'normal': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'default';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" mb={3}>Content Approval Workflow</Typography>

      {/* Pending Requests Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Pending Approvals
              <Badge badgeContent={pendingRequests.length} color="error" sx={{ ml: 2 }} />
            </Typography>
          </Box>

          {pendingRequests.length === 0 ? (
            <Alert severity="info">No pending approval requests</Alert>
          ) : (
            <List>
              {pendingRequests.map((request) => (
                <ListItem key={request.id} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1">
                          {request.postContent?.substring(0, 100)}...
                        </Typography>
                        <Chip
                          label={request.priority}
                          size="small"
                          color={getPriorityColor(request.priority) as any}
                        />
                        <Chip
                          label={request.status}
                          size="small"
                          color={getStatusColor(request.status) as any}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Workflow: {request.workflowName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Step: {request.currentStep + 1}
                        </Typography>
                        {request.dueDate && (
                          <Typography variant="body2" color="text.secondary">
                            Due: {new Date(request.dueDate).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      onClick={() => handleViewProgress(request)}
                      title="View Progress"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => {
                        setSelectedRequest(request);
                        setIsRequestDialogOpen(true);
                      }}
                      title="Make Decision"
                      color="primary"
                    >
                      <CheckIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Workflows Section */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Approval Workflows</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateWorkflow}
            >
              Create Workflow
            </Button>
          </Box>

          <Grid container spacing={2}>
            {workflows.map((workflow) => (
              <Grid item xs={12} md={6} key={workflow.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6">
                        {workflow.name}
                        {workflow.isDefault && (
                          <Chip label="Default" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleEditWorkflow(workflow)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Box>
                    </Box>

                    {workflow.description && (
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {workflow.description}
                      </Typography>
                    )}

                    <Typography variant="body2" mb={1}>
                      Steps: {workflow.steps.length}
                    </Typography>

                    <Box>
                      {workflow.steps.map((step, index) => (
                        <Chip
                          key={index}
                          label={step.name}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Workflow Editor Dialog */}
      <Dialog
        open={isWorkflowDialogOpen}
        onClose={() => setIsWorkflowDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedWorkflow ? 'Edit Workflow' : 'Create Workflow'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Workflow Name"
                value={workflowForm.name}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={workflowForm.isDefault}
                    onChange={(e) => setWorkflowForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                  />
                }
                label="Default Workflow"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={workflowForm.description}
                onChange={(e) => setWorkflowForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            
            {/* Workflow Steps */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Approval Steps</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addWorkflowStep}
                >
                  Add Step
                </Button>
              </Box>

              <Stepper orientation="vertical">
                {workflowForm.steps.map((step, index) => (
                  <Step key={index} active={true}>
                    <StepLabel>Step {index + 1}</StepLabel>
                    <StepContent>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Step Name"
                            value={step.name}
                            onChange={(e) => updateWorkflowStep(index, { ...step, name: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            label="Required Approvers"
                            type="number"
                            value={step.requiredApprovers}
                            onChange={(e) => updateWorkflowStep(index, { 
                              ...step, 
                              requiredApprovers: parseInt(e.target.value) || 1 
                            })}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Description"
                            value={step.description || ''}
                            onChange={(e) => updateWorkflowStep(index, { ...step, description: e.target.value })}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={step.allowSelfApproval}
                                onChange={(e) => updateWorkflowStep(index, { 
                                  ...step, 
                                  allowSelfApproval: e.target.checked 
                                })}
                              />
                            }
                            label="Allow Self Approval"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => removeWorkflowStep(index)}
                            disabled={workflowForm.steps.length === 1}
                          >
                            Remove Step
                          </Button>
                        </Grid>
                      </Grid>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsWorkflowDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveWorkflow} variant="contained" disabled={loading}>
            {selectedWorkflow ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Decision Dialog */}
      <Dialog
        open={isRequestDialogOpen}
        onClose={() => setIsRequestDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Make Approval Decision</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Post Content: {selectedRequest.postContent?.substring(0, 200)}...
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Decision</InputLabel>
                <Select
                  value={decisionForm.action}
                  onChange={(e) => setDecisionForm(prev => ({ 
                    ...prev, 
                    action: e.target.value as 'approve' | 'reject' | 'request_changes'
                  }))}
                >
                  <MenuItem value="approve">Approve</MenuItem>
                  <MenuItem value="request_changes">Request Changes</MenuItem>
                  <MenuItem value="reject">Reject</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Comments"
                multiline
                rows={4}
                value={decisionForm.comments}
                onChange={(e) => setDecisionForm(prev => ({ ...prev, comments: e.target.value }))}
                helperText="Optional comments about your decision"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => selectedRequest && handleProcessDecision(selectedRequest.id)} 
            variant="contained" 
            disabled={loading}
          >
            Submit Decision
          </Button>
        </DialogActions>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog
        open={isProgressDialogOpen}
        onClose={() => setIsProgressDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approval Progress</DialogTitle>
        <DialogContent>
          {workflowProgress && selectedRequest && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Post: {selectedRequest.postContent?.substring(0, 100)}...
              </Typography>

              <Box mb={3}>
                <Typography variant="body2" mb={1}>
                  Progress: {workflowProgress.completedSteps} of {workflowProgress.totalSteps} steps completed
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={(workflowProgress.completedSteps / workflowProgress.totalSteps) * 100} 
                />
              </Box>

              <Typography variant="h6" mb={2}>Current Step: {workflowProgress.currentStep + 1}</Typography>
              
              {workflowProgress.pendingApprovers.length > 0 && (
                <Box mb={2}>
                  <Typography variant="body2" mb={1}>Pending Approvers:</Typography>
                  {workflowProgress.pendingApprovers.map((approver, index) => (
                    <Chip key={index} label={approver} size="small" sx={{ mr: 1 }} />
                  ))}
                </Box>
              )}

              {workflowProgress.canApprove && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  You can approve this request
                </Alert>
              )}

              {workflowProgress.nextSteps.length > 0 && (
                <Box>
                  <Typography variant="body2" mb={1}>Next Steps:</Typography>
                  {workflowProgress.nextSteps.map((step, index) => (
                    <Typography key={index} variant="body2" color="text.secondary">
                      {step.stepNumber + 1}. {step.name}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsProgressDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ContentApprovalWorkflow;