import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ContentApprovalWorkflow from '../../components/ContentManagement/ContentApprovalWorkflow';

// Mock fetch
global.fetch = vi.fn();

const mockWorkflows = [
  {
    id: '1',
    name: 'Standard Review',
    description: 'Standard content review workflow',
    steps: [
      {
        stepNumber: 0,
        name: 'Initial Review',
        requiredRoles: ['editor'],
        requiredApprovers: 1,
        allowSelfApproval: false
      },
      {
        stepNumber: 1,
        name: 'Final Approval',
        requiredRoles: ['admin'],
        requiredApprovers: 1,
        allowSelfApproval: true
      }
    ],
    isActive: true,
    isDefault: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockPendingRequests = [
  {
    id: '1',
    postId: 'post-1',
    workflowId: '1',
    requesterId: 'user-1',
    currentStep: 0,
    status: 'pending' as const,
    priority: 'normal' as const,
    postContent: 'Test post content for approval',
    workflowName: 'Standard Review',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

describe('ContentApprovalWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('renders workflow management interface', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPendingRequests })
    });

    render(<ContentApprovalWorkflow />);

    expect(screen.getByText('Content Approval Workflow')).toBeInTheDocument();
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('Approval Workflows')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Standard Review')).toBeInTheDocument();
    });
  });

  test('displays pending approval requests', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPendingRequests })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      expect(screen.getByText('Test post content for approval...')).toBeInTheDocument();
      expect(screen.getByText('normal')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  test('opens workflow creation dialog', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      const createButton = screen.getByText('Create Workflow');
      fireEvent.click(createButton);
    });

    expect(screen.getByText('Create Workflow')).toBeInTheDocument();
    expect(screen.getByLabelText('Workflow Name')).toBeInTheDocument();
    expect(screen.getByText('Approval Steps')).toBeInTheDocument();
  });

  test('handles approval decision', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPendingRequests })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      const approveButton = screen.getByTitle('Make Decision');
      fireEvent.click(approveButton);
    });

    expect(screen.getByText('Make Approval Decision')).toBeInTheDocument();
    expect(screen.getByLabelText('Decision')).toBeInTheDocument();
    expect(screen.getByLabelText('Comments')).toBeInTheDocument();
  });

  test('shows workflow progress', async () => {
    const mockProgress = {
      currentStep: 0,
      totalSteps: 2,
      completedSteps: 0,
      pendingApprovers: ['editor@example.com'],
      canApprove: true,
      nextSteps: [
        {
          stepNumber: 1,
          name: 'Final Approval',
          requiredRoles: ['admin'],
          requiredApprovers: 1,
          allowSelfApproval: true
        }
      ]
    };

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPendingRequests })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockProgress })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      const progressButton = screen.getByTitle('View Progress');
      fireEvent.click(progressButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Approval Progress')).toBeInTheDocument();
      expect(screen.getByText('Progress: 0 of 2 steps completed')).toBeInTheDocument();
      expect(screen.getByText('You can approve this request')).toBeInTheDocument();
    });
  });

  test('creates new workflow with steps', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      const createButton = screen.getByText('Create Workflow');
      fireEvent.click(createButton);
    });

    // Fill in workflow details
    const nameInput = screen.getByLabelText('Workflow Name');
    fireEvent.change(nameInput, { target: { value: 'New Workflow' } });

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'Test workflow description' } });

    // Add another step
    const addStepButton = screen.getByText('Add Step');
    fireEvent.click(addStepButton);

    // Save workflow
    const saveButton = screen.getByText('Create');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/content-approval/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: expect.stringContaining('New Workflow')
      });
    });
  });

  test('processes approval decision', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWorkflows })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockPendingRequests })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      const approveButton = screen.getByTitle('Make Decision');
      fireEvent.click(approveButton);
    });

    // Fill in decision
    const commentsInput = screen.getByLabelText('Comments');
    fireEvent.change(commentsInput, { target: { value: 'Looks good to me!' } });

    // Submit decision
    const submitButton = screen.getByText('Submit Decision');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/content-approval/requests/1/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: expect.stringContaining('approve')
      });
    });
  });

  test('handles API errors gracefully', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<ContentApprovalWorkflow />);

    // Component should still render even with API errors
    expect(screen.getByText('Content Approval Workflow')).toBeInTheDocument();
  });

  test('shows empty state when no workflows exist', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<ContentApprovalWorkflow />);

    await waitFor(() => {
      expect(screen.getByText('No pending approval requests')).toBeInTheDocument();
    });
  });
});