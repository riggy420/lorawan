package internal

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// StartServer initialises the Gin HTTP server on the given address.
// Call InitDB before this and defer CloseDB after the caller exits.
func StartServer(addr string) error {
	r := gin.Default()

	api := r.Group("/api")
	{
		api.GET("/regions", handleRegions)
		api.GET("/deviceeuis", handleDeviceEUIs)
		api.GET("/doorids", handleDoorIDs)
		api.GET("/recent", handleRecent)
		api.GET("/stats", handleStats)
		api.GET("/sensors", handleSensorsByRegion)
		api.GET("/sensor/:eui", handleSensorDetail)
	}

	return r.Run(addr)
}

func handleRegions(c *gin.Context) {
	regions, err := QueryUniqueRegions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":   len(regions),
		"regions": regions,
	})
}

func handleDeviceEUIs(c *gin.Context) {
	deviceEUIs, err := QueryUniqueDeviceEUIs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":      len(deviceEUIs),
		"deviceEuis": deviceEUIs,
	})
}

func handleDoorIDs(c *gin.Context) {
	doorIDs, err := QueryDoorIDs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":   len(doorIDs),
		"doorIds": doorIDs,
	})
}

func handleRecent(c *gin.Context) {
	entries, err := QueryRecentEntries(5)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
	})
}

func handleStats(c *gin.Context) {
	stats, err := QueryHourlyStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func handleSensorsByRegion(c *gin.Context) {
	region := c.Query("region")
	if region == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'region' is required"})
		return
	}

	sensors, err := QuerySensorsByRegion(region)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"region":  region,
		"sensors": sensors,
		"count":   len(sensors),
	})
}

func handleSensorDetail(c *gin.Context) {
	eui := c.Param("eui")
	if eui == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device EUI is required"})
		return
	}

	detail, err := QuerySensorDetail(eui)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, detail)
}
