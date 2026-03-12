package hubagi

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// ============================
// Request / Response structures
// ============================

type Subject struct {
	Images  []string `json:"images"`
	ID      string   `json:"id,omitempty"`
	VoiceID string   `json:"voice_id,omitempty"`
}

type requestPayload struct {
	Model       string    `json:"model"`
	Prompt      string    `json:"prompt,omitempty"`
	Images      []string  `json:"images,omitempty"`
	Subjects    []Subject `json:"subjects,omitempty"`
	Duration    int       `json:"duration,omitempty"`
	AspectRatio string    `json:"aspect_ratio,omitempty"`
	Resolution  string    `json:"resolution,omitempty"`
	OffPeak     bool      `json:"off_peak,omitempty"`
	CallbackUrl string    `json:"callback_url,omitempty"`
}

type submitResponse struct {
	TaskID    string `json:"task_id"`
	State     string `json:"state"`
	Model     string `json:"model"`
	Credits   int    `json:"credits"`
	Prompt    string `json:"prompt"`
	Duration  int    `json:"duration"`
	ErrorMsg  string `json:"error_msg"`
	CreatedAt string `json:"created_at"`
}

type fetchResponse struct {
	ID        int64  `json:"id"`
	TaskID    string `json:"task_id"`
	State     string `json:"state"`
	Model     string `json:"model"`
	Prompt    string `json:"prompt"`
	ErrorMsg  string `json:"error_msg"`
	Credits   int    `json:"credits"`
	ResultURL string `json:"result_url"`
	OffPeak   bool   `json:"off_peak"`
	CreatedAt string `json:"created_at"`
}

// ============================
// Adaptor implementation
// ============================

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = info.ChannelBaseUrl
}

// EstimateBilling returns OtherRatios based on duration (seconds) and resolution.
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil
	}

	seconds := req.Duration
	if seconds <= 0 {
		seconds = 5 // HUBAGI default duration
	}

	otherRatios := map[string]float64{
		"seconds": float64(seconds),
	}

	// Resolution ratio
	resolution := strings.ToLower(taskcommon.DefaultString(req.Size, "720p"))
	if ratioMap := ratio_setting.GetModelResolutionRatios(info.OriginModelName); ratioMap != nil {
		if ratio, ok := ratioMap[resolution]; ok {
			otherRatios[fmt.Sprintf("resolution-%s", resolution)] = ratio
		}
	}

	return otherRatios
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	if err := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); err != nil {
		return err
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return service.TaskErrorWrapper(err, "get_task_request_failed", http.StatusBadRequest)
	}

	action := constant.TaskActionTextGenerate
	if meatAction, ok := req.Metadata["action"]; ok {
		action, _ = meatAction.(string)
	} else if req.HasImage() {
		action = constant.TaskActionGenerate
		if len(req.Images) == 2 {
			action = constant.TaskActionFirstTailGenerate
		}
	}

	// Check for subjects in metadata (reference2video)
	if _, hasSubjects := req.Metadata["subjects"]; hasSubjects {
		action = constant.TaskActionReferenceGenerate
	}

	info.Action = action
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	var path string
	switch info.Action {
	case constant.TaskActionGenerate:
		path = "/api/v1/video/vidu/img2video"
	case constant.TaskActionFirstTailGenerate:
		path = "/api/v1/video/vidu/start-end2video"
	case constant.TaskActionReferenceGenerate:
		path = "/api/v1/video/vidu/reference2video"
	default:
		path = "/api/v1/video/vidu/text2video"
	}
	return fmt.Sprintf("%s%s", a.baseURL, path), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	v, exists := c.Get("task_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}
	req := v.(relaycommon.TaskSubmitReq)

	body := a.convertToRequestPayload(&req, info)

	data, err := common.Marshal(body)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	var sResp submitResponse
	err = common.Unmarshal(responseBody, &sResp)
	if err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrap(err, fmt.Sprintf("%s", responseBody)), "unmarshal_response_failed", http.StatusInternalServerError)
		return
	}

	if sResp.State == "failed" {
		msg := sResp.ErrorMsg
		if msg == "" {
			msg = "task failed"
		}
		taskErr = service.TaskErrorWrapperLocal(fmt.Errorf("%s", msg), "task_failed", http.StatusBadRequest)
		return
	}

	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.CreatedAt = time.Now().Unix()
	ov.Model = info.OriginModelName
	c.JSON(http.StatusOK, ov)
	return sResp.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid task_id")
	}

	url := fmt.Sprintf("%s/api/v1/video/vidu/tasks/%s/creations", baseUrl, taskID)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	taskInfo := &relaycommon.TaskInfo{}

	var taskResp fetchResponse
	err := common.Unmarshal(respBody, &taskResp)
	if err != nil {
		return nil, errors.Wrap(err, "failed to unmarshal response body")
	}

	state := taskResp.State
	switch state {
	case "created", "queueing":
		taskInfo.Status = model.TaskStatusSubmitted
	case "processing":
		taskInfo.Status = model.TaskStatusInProgress
	case "success":
		taskInfo.Status = model.TaskStatusSuccess
		if taskResp.ResultURL != "" {
			taskInfo.Url = taskResp.ResultURL
		}
	case "failed":
		taskInfo.Status = model.TaskStatusFailure
		if taskResp.ErrorMsg != "" {
			taskInfo.Reason = taskResp.ErrorMsg
		}
	default:
		return nil, fmt.Errorf("unknown task state: %s", state)
	}

	return taskInfo, nil
}

func (a *TaskAdaptor) ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error) {
	var hubagiResp fetchResponse
	if err := common.Unmarshal(originTask.Data, &hubagiResp); err != nil {
		return nil, errors.Wrap(err, "unmarshal hubagi task data failed")
	}

	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = originTask.TaskID
	openAIVideo.Status = originTask.Status.ToVideoStatus()
	openAIVideo.SetProgressStr(originTask.Progress)
	openAIVideo.CreatedAt = originTask.CreatedAt
	openAIVideo.CompletedAt = originTask.UpdatedAt

	if hubagiResp.ResultURL != "" {
		openAIVideo.SetMetadata("url", hubagiResp.ResultURL)
	}

	if hubagiResp.State == "failed" && hubagiResp.ErrorMsg != "" {
		openAIVideo.Error = &dto.OpenAIVideoError{
			Message: hubagiResp.ErrorMsg,
			Code:    hubagiResp.ErrorMsg,
		}
	}

	return common.Marshal(openAIVideo)
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return "hubagi"
}

// ============================
// helpers
// ============================

func (a *TaskAdaptor) convertToRequestPayload(req *relaycommon.TaskSubmitReq, info *relaycommon.RelayInfo) *requestPayload {
	r := &requestPayload{
		Model:      taskcommon.DefaultString(info.UpstreamModelName, "TC-vidu-q2"),
		Prompt:     req.Prompt,
		Duration:   taskcommon.DefaultInt(req.Duration, 5),
		Resolution: taskcommon.DefaultString(req.Size, "720p"),
	}

	// Pass images for img2video / start-end2video
	if info.Action == constant.TaskActionGenerate || info.Action == constant.TaskActionFirstTailGenerate {
		r.Images = req.Images
	}

	// Parse subjects and other extra fields from metadata
	if req.Metadata != nil {
		if ar, ok := req.Metadata["aspect_ratio"].(string); ok {
			r.AspectRatio = ar
		}
		if op, ok := req.Metadata["off_peak"].(bool); ok {
			r.OffPeak = op
		}
		if cb, ok := req.Metadata["callback_url"].(string); ok {
			// Only allow callback URLs with http/https scheme
			if strings.HasPrefix(cb, "http://") || strings.HasPrefix(cb, "https://") {
				r.CallbackUrl = cb
			}
		}
		// subjects for reference2video
		if subjectsRaw, ok := req.Metadata["subjects"]; ok {
			subjectsBytes, err := common.Marshal(subjectsRaw)
			if err == nil {
				var subjects []Subject
				if err := common.Unmarshal(subjectsBytes, &subjects); err == nil {
					r.Subjects = subjects
				}
			}
		}
	}

	return r
}
