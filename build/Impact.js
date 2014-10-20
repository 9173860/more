var KEY_HASH=function(){var _5=require('./abbreviationKey.js');return _5.hasOwnProperty("KEY_HASH")?_5.KEY_HASH:_5.hasOwnProperty("default")?_5.default:_5}();


  function Impact() {
    this.imCache = {};
  }
  Impact.prototype.noImpact = function(list, first, last) {
    for(var i = Math.min(first, last); i <= Math.max(first, last); i++) {
      if(list[i].s2s.indexOf(':-ms-') > -1) {
        return false;
      }
    }
    //紧邻选择器无优先级影响
    if(first == last - 1 || first == last + 1) {
      return true;
    }
    //非紧邻先取可能缓存的判断结果
    else if(this.imCache.hasOwnProperty([first + ',' + last])) {
      return this.imCache[first + ',' + last];
    }
    //非紧邻若无相同样式或important优先级不同无影响
    else {
      var hash = {};
      var abbreviation = {};
      //将last的样式出现记录在hash上
      list[last].styles.forEach(function(style) {
        var key = getKey(style);
        hash[key] = {
          important: style.important,
          value: style.value
        };
        //注意一些缩写语句
        if(KEY_HASH.hasOwnProperty(key)) {
          abbreviation[KEY_HASH[key]] = {
            important: style.important
          };
        }
      });
      //向前和向后以索引大小为基准
      if(first < last) {
        for(var i = first + 1; i < last; i++) {
          var item = list[i];
          var styles = item.styles;
          for(var j = 0, len = styles.length; j < len; j++) {
            var style = styles[j];
            var key = getKey(style);
            //值不等且优先级不等时冲突
            if(hash[key]
              && hash[key].value != style.value
              && hash[key].important == style.important) {
              this.imCache[i + ',' + last] = false;
              return false;
            }
            //有缩写且优先级不等也冲突
            else if(!hash[key] && KEY_HASH.hasOwnProperty(key)) {
              if(abbreviation.hasOwnProperty(KEY_HASH[key])
                && style.important == abbreviation[KEY_HASH[key]].important) {
                this.imCache[i + ',' + last] = false;
                return false;
              }
            }
          }
          this.imCache[i + ',' + last] = true;
        }
      }
      else {
        for(var i = first - 1; i > last; i--) {
          var item = list[i];
          var styles = item.styles;
          for(var j = 0, len = styles.length; j < len; j++) {
            var style = styles[j];
            var key = getKey(style);
            if(hash[key]
              && hash[key].value != style.value
              && hash[key].important == style.important) {
              this.imCache[i + ',' + last] = false;
              return false;
            }
            else if(!hash[key] && KEY_HASH.hasOwnProperty(key)) {
              if(abbreviation.hasOwnProperty(KEY_HASH[key])
                && style.important == abbreviation[KEY_HASH[key]].important) {
                this.imCache[i + ',' + last] = false;
                return false;
              }
            }
          }
          this.imCache[i + ',' + last] = true;
        }
      }
    }
    this.imCache[first + ',' + last] = true;
    return true;
  }
  Impact.prototype.upCache = function(index) {
    var self = this;
    Object.keys(self.imCache).forEach(function(key) {
      var arr = key.split(',');
      if(arr[0] == index) {
        self.imCache[(index-1) + ',' + arr[1]] = self.imCache[key];
        delete imCache[key];
      }
      else if(arr[1] == index) {
        self.imCache[arr[0] + ',' + (index-1)] = self.imCache[key];
        delete self.imCache[key];
      }
    });
  }


function getKey(style) {
  return style.key.slice(style.prefixHack.length).toLowerCase();
}

exports.default=Impact;