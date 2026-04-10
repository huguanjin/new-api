import React, { useEffect, useRef, useState } from 'react';
import { Button, Col, Form, Row, Spin } from '@douyinfe/semi-ui';
import {
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_VIDEO_INPUTS = {
  'video.providers': '[]',
};

export default function SettingVideoModel(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_VIDEO_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_VIDEO_INPUTS);
  const refForm = useRef();

  async function onSubmit() {
    await refForm.current
      .validate()
      .then(() => {
        const updateArray = compareObjects(inputs, inputsRow);
        if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

        const requestQueue = updateArray.map((item) => {
          const value = inputs[item.key];
          return API.put('/api/option/', { key: item.key, value });
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
      })
      .catch((error) => {
        console.error('Validation failed:', error);
        showError(t('请检查输入'));
      });
  }

  useEffect(() => {
    const currentInputs = { ...DEFAULT_VIDEO_INPUTS };
    for (const key of Object.keys(DEFAULT_VIDEO_INPUTS)) {
      if (props.options[key] !== undefined) {
        currentInputs[key] = props.options[key];
      }
    }

    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
    if (refForm.current) {
      refForm.current.setValues(currentInputs);
    }
  }, [props.options]);

  return (
    <Spin spinning={loading}>
      <Form
        values={inputs}
        getFormApi={(formAPI) => (refForm.current = formAPI)}
        style={{ marginBottom: 15 }}
      >
        <Form.Section text={t('视频模型设置')}>
          <Row>
            <Col span={24}>
              <Form.TextArea
                label={t('视频供应商配置JSON')}
                extraText={t('配置视频页面的供应商和模型下拉列表')}
                placeholder='[]'
                field={'video.providers'}
                autosize={{ minRows: 6, maxRows: 24 }}
                rules={[
                  {
                    validator: (rule, value) => verifyJSON(value),
                  },
                ]}
                onChange={(value) =>
                  setInputs({ ...inputs, 'video.providers': value })
                }
              />
            </Col>
          </Row>

          <Row>
            <Button size='default' onClick={onSubmit}>
              {t('保存')}
            </Button>
          </Row>
        </Form.Section>
      </Form>
    </Spin>
  );
}
