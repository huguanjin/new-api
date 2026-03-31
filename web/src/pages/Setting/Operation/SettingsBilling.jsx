import React, { useEffect, useState, useRef } from 'react';
import {
  Banner,
  Button,
  Col,
  Form,
  Row,
  Spin,
  Typography,
} from '@douyinfe/semi-ui';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

export default function SettingsBilling(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState({
    'billing_setting.no_output_no_billing_models': '',
    'billing_setting.task_per_call_billing_models': '',
  });
  const refForm = useRef();
  const [inputsRow, setInputsRow] = useState(inputs);

  function handleFieldChange(fieldName) {
    return (value) => {
      setInputs((inputs) => ({ ...inputs, [fieldName]: value }));
    };
  }

  function onSubmit() {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      let value = '';
      if (typeof inputs[item.key] === 'boolean') {
        value = String(inputs[item.key]);
      } else {
        value = String(inputs[item.key]);
      }
      return API.put('/api/option/', {
        key: item.key,
        value,
      });
    });
    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (requestQueue.length === 1) {
          if (res.includes(undefined)) return;
        } else if (requestQueue.length > 1) {
          if (res.includes(undefined))
            return showError(t('部分保存失败，请重试'));
        }
        showSuccess(t('保存成功'));
        props.refresh();
      })
      .catch(() => {
        showError(t('保存失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    const currentInputs = {};
    for (let key in props.options) {
      if (Object.keys(inputs).includes(key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    refForm.current.setValues(currentInputs);
  }, [props.options]);

  return (
    <>
      <Spin spinning={loading}>
        <Form
          values={inputs}
          getFormApi={(formAPI) => (refForm.current = formAPI)}
          style={{ marginBottom: 15 }}
        >
          <Form.Section text={t('计费设置')}>
            <Row gutter={16}>
              <Col span={24}>
                <Form.TextArea
                  field={'billing_setting.no_output_no_billing_models'}
                  label={t('无输出不扣费模型')}
                  placeholder={t(
                    '输入模型名称，多个用英文逗号分隔，支持 * 通配符，例如：gemini-*-image-preview,gpt-image-*',
                  )}
                  onChange={handleFieldChange(
                    'billing_setting.no_output_no_billing_models',
                  )}
                  autosize={{ minRows: 2, maxRows: 6 }}
                />
              </Col>
            </Row>
            <Banner
              type='info'
              description={t(
                '配置后，当这些模型的请求没有产生输出（补全 token 为 0）时，将不会扣费。适用于图片生成模型因审核拦截等原因未返回图片的场景。支持通配符：gemini-* 匹配以 gemini- 开头的模型，*-image-* 匹配包含 -image- 的模型。',
              )}
              style={{ marginBottom: 16 }}
            />
            <Row gutter={16}>
              <Col span={24}>
                <Form.TextArea
                  field={'billing_setting.task_per_call_billing_models'}
                  label={t('任务按次计费模型')}
                  placeholder={t(
                    '输入模型名称，多个用英文逗号分隔，支持 * 通配符，例如：sora-*,veo-*,kling-*',
                  )}
                  onChange={handleFieldChange(
                    'billing_setting.task_per_call_billing_models',
                  )}
                  autosize={{ minRows: 2, maxRows: 6 }}
                />
              </Col>
            </Row>
            <Banner
              type='info'
              description={t(
                '配置后，列表中的视频模型提交任务时将按固定价格计费，不再乘以时长、分辨率等参数倍率。未在列表中的模型仍按默认的参数倍率计费。支持通配符：sora-* 匹配以 sora- 开头的模型。也可通过环境变量 TASK_PRICE_PATCH 配置（两处取并集）。',
              )}
              style={{ marginBottom: 16 }}
            />
            <Row>
              <Button size='default' onClick={onSubmit}>
                {t('保存计费设置')}
              </Button>
            </Row>
          </Form.Section>
        </Form>
      </Spin>
    </>
  );
}
