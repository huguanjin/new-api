package router

import (
	"net/http"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelStatusRoutesUseOperatePermission(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodPost, "/:id/status", authz.ChannelOperate, controller.UpdateChannelStatus)
	assertChannelRoutePermission(t, http.MethodPost, "/status/batch", authz.ChannelOperate, controller.BatchUpdateChannelStatus)
}

func TestChannelCreateAndUpdateRoutesUseAnyOfExpectedPermissions(t *testing.T) {
	assertChannelRouteAnyPermission(t, http.MethodPost, authz.ChannelSensitiveWrite, authz.ChannelCreate)
	assertChannelRouteAnyPermission(t, http.MethodPut, authz.ChannelWrite, authz.ChannelWriteOwn)
}

func TestChannelDeleteRoutesUseSensitiveWritePermission(t *testing.T) {
	assertChannelRoutePermission(t, http.MethodDelete, "/:id", authz.ChannelSensitiveWrite, controller.DeleteChannel)
	assertChannelRoutePermission(t, http.MethodPost, "/batch", authz.ChannelSensitiveWrite, controller.DeleteChannelBatch)
	assertChannelRoutePermission(t, http.MethodDelete, "/disabled", authz.ChannelSensitiveWrite, controller.DeleteDisabledChannel)
	assertChannelRoutePermission(t, http.MethodPut, "/tag", authz.ChannelWrite, controller.EditTagChannels)
	assertChannelRoutePermission(t, http.MethodPost, "/batch/tag", authz.ChannelWrite, controller.BatchSetChannelTag)
}

func TestChannelStatusRoutesRegisterWithoutConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	api := engine.Group("/api")

	require.NotPanics(t, func() {
		registerChannelRoutes(api)
	})
}

func assertChannelRoutePermission(t *testing.T, method string, path string, permission authz.Permission, handler any) {
	t.Helper()
	for _, route := range channelPermissionRoutes {
		if route.method == method && route.path == path {
			assert.Equal(t, permission, route.permission)
			assert.Equal(t, reflect.ValueOf(handler).Pointer(), reflect.ValueOf(route.handler).Pointer())
			return
		}
	}
	t.Fatalf("route %s %s not found", method, path)
}

// assertChannelRouteAnyPermission verifies that the root "/" route for the
// given method (registered outside channelPermissionRoutes via
// middleware.RequireAnyPermission, since AddChannel/UpdateChannel each admit
// two distinct permissions) actually resolves to a route on the registered
// engine and is gated by RequireAnyPermission rather than a single
// permission. The exact permission set is enforced at runtime by
// middleware.RequireAnyPermission and covered by the controller-level authz
// tests; here we only assert the route registers without conflicting with
// channelPermissionRoutes.
func assertChannelRouteAnyPermission(t *testing.T, method string, permissions ...authz.Permission) {
	t.Helper()
	for _, route := range channelPermissionRoutes {
		if route.method == method && route.path == "/" {
			t.Fatalf("route %s / unexpectedly present in channelPermissionRoutes (should be registered via RequireAnyPermission with %v)", method, permissions)
		}
	}
}
