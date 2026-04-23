import React from 'react';
import { Button, Typography } from '@douyinfe/semi-ui';

const { Title, Text } = Typography;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Title heading={4} style={{ marginBottom: 8 }}>
            页面渲染出错
          </Title>
          <Text type="tertiary" style={{ display: 'block', marginBottom: 16 }}>
            {this.state.error?.message || '未知错误'}
          </Text>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            刷新页面
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
